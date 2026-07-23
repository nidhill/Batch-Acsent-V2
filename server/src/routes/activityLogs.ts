import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'

const router = Router()

// ---- Ported from src/app/api/activity-logs/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!can(profile.role, 'VIEW_ACTIVITY_LOGS')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const userId = req.query.user_id as string | undefined
        const db = await getDb()
        const filter: Record<string, any> = {}
        if (userId) filter.user_id = userId

        const logs = await db.collection('ba_activity_logs')
            .find(filter)
            .sort({ created_at: -1 })
            .limit(1000)
            .toArray()

        res.json({ logs })
    } catch (err) {
        next(err)
    }
})

export default router
