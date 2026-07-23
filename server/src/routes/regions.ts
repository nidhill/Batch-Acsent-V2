import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// ---- Ported from src/app/api/regions/route.ts ----
// Regions are not sensitive — readable without auth, same as /api/schools, since forms
// (e.g. signup, admission) may need the list before/without a session.
router.get('/', async (req, res, next) => {
    try {
        const db = await getDb()
        const regions = await db.collection('ba_regions').find({ is_active: true }).sort({ name: 1 }).toArray()
        res.json({ regions })
    } catch (err) {
        next(err)
    }
})

// Admin-configurable, per the SRS ("Future regions should be configurable by the Admin").
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_SCHOOLS_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const { name, code } = req.body
        if (!name || !code) {
            res.status(400).json({ error: 'name and code are required' })
            return
        }

        const db = await getDb()
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const existing = await db.collection('ba_regions').findOne({ _id: id as any })
        if (existing) {
            res.status(409).json({ error: 'A region with this name already exists' })
            return
        }

        const doc = { _id: id as any, name, code: code.toUpperCase(), is_active: true, created_at: new Date().toISOString() }
        await db.collection('ba_regions').insertOne(doc)

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'REGION_CREATED', details: { region_id: id, name, code },
        })

        res.json({ success: true, region: doc })
    } catch (err) {
        next(err)
    }
})

export default router
