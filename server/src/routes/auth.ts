import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { logMongoActivity } from '../lib/mongoActivity'
import { notifyUsers, findUserIdsByRole } from '../lib/notify'

const router = Router()

const SCHOOL_PREFIXES: Record<string, string> = {
    'Tech School': 'TS',
    'Marketing School': 'MS',
    'Design School': 'DS',
    'Finance School': 'FS',
}

async function generateSalesId(db: Awaited<ReturnType<typeof getDb>>, school: string) {
    const prefix = SCHOOL_PREFIXES[school] || 'EX'
    const counter = await db.collection('ba_sales_id_counters').findOneAndUpdate(
        { _id: prefix as any },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: 'after' }
    )
    const num = counter?.count || 1
    return `${prefix}-${String(num).padStart(2, '0')}`
}

// Ported from src/app/api/auth/login/route.ts. Runs right after Supabase Auth sign-in: loads
// the Mongo profile, flags PENDING/missing-phone states, and atomically assigns a sales_id
// for SALES users the first time they log in.
router.post('/login', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { phone } = req.body || {}

        if (profile.role === 'PENDING') {
            res.json({ pending: true })
            return
        }

        // SHO/SSHO are already rejected earlier, in requireUser() (mongoAuth.ts) — that covers
        // every authenticated route, not just this one, so no separate check is needed here.

        const db = await getDb()

        if (profile.role === 'SALES' && !profile.phone && !phone) {
            res.json({ needs_phone: true, profile })
            return
        }

        let finalProfile = profile
        const updates: Record<string, any> = {}

        if (profile.role === 'SALES' && phone && !profile.phone) {
            updates.phone = phone
        }

        if (profile.role === 'SALES' && (profile.phone || phone) && !profile.sales_id) {
            updates.sales_id = await generateSalesId(db, profile.school || '')
        }

        if (Object.keys(updates).length > 0) {
            updates.updated_at = new Date().toISOString()
            const result = await db.collection('ba_users').findOneAndUpdate(
                { _id: authUserId as any },
                { $set: updates },
                { returnDocument: 'after' }
            )
            if (result) finalProfile = result as any
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: finalProfile.name, userEmail: finalProfile.email, userRole: finalProfile.role,
            action: 'LOGIN', details: { school: finalProfile.school || null },
        })

        res.json({ profile: { ...finalProfile, id: (finalProfile as any)._id } })
    } catch (err) {
        next(err)
    }
})

// Ported from src/app/api/auth/profile/route.ts. Returns the caller's own Mongo profile.
router.get('/profile', authenticate, async (req, res) => {
    const { profile } = req.auth!
    res.json({ profile: { ...profile, id: (profile as any)._id } })
})

// Ported from src/app/api/auth/signup-profile/route.ts. Creates the Mongo PENDING profile
// right after Supabase Auth signup — doesn't use `authenticate` since the caller has no
// Mongo profile yet at this point (that's exactly what this route creates), so it verifies
// the Supabase token manually, same as the original.
router.post('/signup-profile', async (req, res) => {
    try {
        const { email, name, role, school } = req.body || {}
        const authHeader = req.headers.authorization
        if (!authHeader) {
            res.status(401).json({ error: 'Missing Authorization header' })
            return
        }

        const supabaseUrl = process.env.SUPABASE_URL!
        const anonKey = process.env.SUPABASE_ANON_KEY!
        const supabase = createClient(supabaseUrl, anonKey)
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (error || !user) {
            res.status(401).json({ error: 'Invalid token' })
            return
        }

        const db = await getDb()
        const now = new Date().toISOString()
        await db.collection('ba_users').updateOne(
            { _id: user.id as any },
            {
                $set: { email, name, role: 'PENDING', requested_role: role, school: school || null, updated_at: now },
                $setOnInsert: { _id: user.id, created_at: now },
            },
            { upsert: true }
        )

        const adminIds = await findUserIdsByRole(['ADMIN'])
        await notifyUsers({
            userIds: adminIds,
            type: 'new_user_approval',
            title: 'New signup awaiting approval',
            message: `${name} (${email}) signed up requesting role ${role}.`,
            link: '/dashboard/admin/approve-users',
        })

        res.json({ success: true })
    } catch (err: any) {
        console.error('POST /api/auth/signup-profile error:', err)
        res.status(500).json({ error: err.message || 'Internal Server Error' })
    }
})

export default router
