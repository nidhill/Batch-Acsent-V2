import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'

const router = Router()

// ---- Ported from src/app/api/log-activity/route.ts ----
// Deliberately unauthenticated, same as the original: called from the client's logActivity
// helper which doesn't attach a bearer token (see client/src/lib/logActivity.ts).
router.post('/', async (req, res, next) => {
    try {
        const { user_id, user_name, user_email, user_role, action, details } = req.body

        const ip =
            (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            (req.headers['x-real-ip'] as string) ||
            'Unknown'
        const userAgent = req.headers['user-agent'] || 'Unknown'

        const db = await getDb()
        await db.collection('ba_activity_logs').insertOne({
            _id: randomUUID() as any,
            user_id: user_id || null,
            user_name: user_name || '',
            user_email: user_email || '',
            user_role: user_role || '',
            action,
            details: details || {},
            ip_address: ip,
            user_agent: userAgent,
            created_at: new Date().toISOString(),
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
