import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'

const router = Router()

// ---- Ported from src/app/api/users/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const role = req.query.role as string | undefined
        const school = req.query.school as string | undefined
        const directory = req.query.directory === '1'

        const db = await getDb()

        // "directory" lookups (e.g. populating an Academic Lead / SHO dropdown when creating a
        // batch) are available to any authenticated user, but only for name/school/role —
        // never PENDING users or any PII. Everything else still requires MANAGE_USERS.
        if (directory) {
            if (!role || role === 'PENDING') {
                res.status(400).json({ error: 'Invalid directory query' })
                return
            }
            const filter: Record<string, any> = { role: { $in: role.split(',') } }
            if (school) filter.school = school
            // sales_id isn't PII (an internal work code, already shown in several other views) —
            // needed so a "credit this admission to" dropdown can display and disambiguate reps.
            const users = await db.collection('ba_users').find(filter).project({ name: 1, school: 1, role: 1, sales_id: 1 }).toArray()
            res.json({ users })
            return
        }

        if (!can(profile.role, 'MANAGE_USERS')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const filter: Record<string, any> = {}
        if (role) filter.role = role

        const users = await db.collection('ba_users').find(filter).sort({ created_at: -1 }).toArray()
        res.json({ users })
    } catch (err) {
        next(err)
    }
})

export default router
