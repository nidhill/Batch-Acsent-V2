import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { getDb } from '../lib/mongodb'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// These three routes touch real Supabase Auth accounts (delete/invite/update), so — same as
// the original — they verify the caller manually against ba_users instead of going through the
// shared `authenticate` middleware: an Admin/SUB_ADMIN role check with a plain 403 on failure,
// not the "no profile" 401 that `requireUser` would throw. Preserved exactly to avoid changing
// behavior on the most sensitive routes in the whole port.
async function verifyAdminCaller(authHeader: string | undefined) {
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
        return { ok: false as const, status: 500, message: 'Server configuration error' }
    }
    if (!authHeader) {
        return { ok: false as const, status: 401, message: 'Missing Authorization header' }
    }
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, anonKey)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
        return { ok: false as const, status: 401, message: 'Invalid token' }
    }

    const db = await getDb()
    const caller = await db.collection('ba_users').findOne({ _id: user.id as any })
    if (!caller || (caller.role !== 'ADMIN' && caller.role !== 'SUB_ADMIN')) {
        return { ok: false as const, status: 403, message: 'Forbidden: Admins only' }
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    return { ok: true as const, user, caller, db, supabaseUrl, serviceRoleKey, anonKey, supabaseAdmin }
}

// ---- Ported from src/app/api/delete-user/route.ts ----
router.post('/delete-user', async (req, res, next) => {
    try {
        const { id } = req.body
        if (!id) {
            res.status(400).json({ error: 'User ID is required' })
            return
        }

        const ctx = await verifyAdminCaller(req.headers.authorization)
        if (!ctx.ok) {
            res.status(ctx.status).json({ error: ctx.message })
            return
        }
        const { user, caller, db, supabaseAdmin } = ctx

        const targetUser = await db.collection('ba_users').findOne({ _id: id as any })

        // 1. Delete from Supabase Auth (still the identity provider)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id)
        if (authError) {
            res.status(400).json({ error: authError.message })
            return
        }

        // 2. Delete the Mongo profile
        await db.collection('ba_users').deleteOne({ _id: id as any })

        await logMongoActivity({
            request: req, userId: user.id, userName: caller.name, userEmail: caller.email, userRole: caller.role,
            action: 'USER_DELETE', details: { deleted_user_id: id, deleted_email: targetUser?.email || null, deleted_role: targetUser?.role || null },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/invite/route.ts ----
router.post('/invite', async (req, res, next) => {
    try {
        const { email, role, school, name } = req.body

        const ctx = await verifyAdminCaller(req.headers.authorization)
        if (!ctx.ok) {
            res.status(ctx.status).json({ error: ctx.message })
            return
        }
        const { user, caller, db, supabaseAdmin } = ctx

        let appUrl = process.env.APP_URL
        if (!appUrl) appUrl = req.headers.origin as string || 'http://localhost:5173'

        const now = new Date().toISOString()

        // 1. Invite the user via Supabase Auth (unchanged — still the identity provider)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
            data: { role, school, name },
            redirectTo: `${appUrl}/auth/callback`,
        })

        if (authError) {
            // Handle case where the auth user already exists — re-link + reset password
            if (authError.message.includes('already been registered')) {
                const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
                const existingUser = users.find(u => u.email === email)

                if (existingUser) {
                    await db.collection('ba_users').updateOne(
                        { _id: existingUser.id as any },
                        {
                            $set: { email, name, role: 'PENDING', requested_role: role, school: school || null, updated_at: now },
                            $setOnInsert: { _id: existingUser.id, created_at: now },
                        },
                        { upsert: true }
                    )

                    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
                        redirectTo: `${appUrl}/auth/callback`,
                    })
                    if (resetError) {
                        res.status(400).json({ error: 'User exists but failed to send reset email: ' + resetError.message })
                        return
                    }

                    res.json({ success: true, message: 'User already existed. Re-linked and sent password reset email.' })
                    return
                }
            }
            console.error('Invite failed (Auth):', authError)
            res.status(400).json({ error: authError.message })
            return
        }

        // 2. Create the Mongo profile
        await db.collection('ba_users').updateOne(
            { _id: authData.user.id as any },
            {
                $set: { email, name, role: 'PENDING', requested_role: role, school: school || null, updated_at: now },
                $setOnInsert: { _id: authData.user.id, created_at: now },
            },
            { upsert: true }
        )

        await logMongoActivity({
            request: req, userId: user.id, userName: caller.name, userEmail: caller.email, userRole: caller.role,
            action: 'USER_INVITE', details: { invited_email: email, invited_role: role, school: school || null, invited_name: name },
        })

        res.json({ success: true, user: authData.user })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/update-user/route.ts ----
router.post('/update-user', async (req, res, next) => {
    try {
        const { id, cliq_id, role, school, sales_id, region, is_active } = req.body
        if (!id) {
            res.status(400).json({ error: 'User ID is required' })
            return
        }

        const ctx = await verifyAdminCaller(req.headers.authorization)
        if (!ctx.ok) {
            res.status(ctx.status).json({ error: ctx.message })
            return
        }
        const { user, caller, db, supabaseAdmin } = ctx

        const targetBefore = await db.collection('ba_users').findOne({ _id: id as any })

        const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
        if (cliq_id !== undefined) updateData.cliq_id = cliq_id || null
        if (role !== undefined) updateData.role = role
        if (school !== undefined) updateData.school = school || null
        if (sales_id !== undefined) updateData.sales_id = sales_id || null
        if (region !== undefined) updateData.region = region || null
        // Deactivate/reactivate: revokes login (enforced in requireUser) without touching the
        // profile's sales_id or role, so historical admissions/payments stay correctly
        // attributed — the deliberate alternative to deleting the account outright.
        if (is_active !== undefined) updateData.is_active = !!is_active

        // Update auth.users metadata (unchanged behavior)
        const authMeta: Record<string, any> = {}
        if (role !== undefined) authMeta.role = role
        if (school !== undefined) authMeta.school = school || null
        if (Object.keys(authMeta).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                user_metadata: authMeta,
                app_metadata: authMeta,
            })
            if (authError) console.error('Auth metadata update error (non-fatal):', authError.message)
        }

        // Now update the Mongo profile
        const result = await db.collection('ba_users').findOneAndUpdate(
            { _id: id as any },
            { $set: updateData },
            { returnDocument: 'after' }
        )

        if (!result) {
            res.status(404).json({ error: `No profile found for user id: ${id}` })
            return
        }

        const logDetails: Record<string, any> = { target_user_id: id }
        if (role !== undefined && role !== targetBefore?.role) {
            logDetails.old_role = targetBefore?.role || null
            logDetails.new_role = role
        } else if (role !== undefined) {
            logDetails.new_role = role
        }
        if (school !== undefined) logDetails.school = school || null
        if (sales_id !== undefined) logDetails.sales_id = sales_id
        if (cliq_id !== undefined) logDetails.cliq_id = cliq_id
        if (is_active !== undefined) logDetails.is_active = !!is_active

        const action = is_active !== undefined
            ? (is_active ? 'USER_REACTIVATED' : 'USER_DEACTIVATED')
            : (role !== undefined ? 'ROLE_CHANGE' : 'USER_UPDATE')

        await logMongoActivity({
            request: req, userId: user.id, userName: caller.name, userEmail: caller.email, userRole: caller.role,
            action, details: logDetails,
        })

        res.json({ success: true, updated: { id: result._id, role: result.role, is_active: result.is_active !== false } })
    } catch (err) {
        next(err)
    }
})

export default router
