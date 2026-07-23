import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'

const router = Router()

// ---- Ported from src/app/api/notifications/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId } = req.auth!
        const db = await getDb()

        const notifications = await db.collection('ba_notifications')
            .find({ user_id: authUserId })
            .sort({ created_at: -1 })
            .limit(50)
            .toArray()
        const unread_count = await db.collection('ba_notifications').countDocuments({ user_id: authUserId, is_read: false })

        res.json({ notifications: notifications.map(n => ({ ...n, id: n._id })), unread_count })
    } catch (err) {
        next(err)
    }
})

// Marks one (body: {id}) or all (body: {all: true}) of the caller's own notifications as read.
router.patch('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId } = req.auth!
        const { id, all } = req.body
        const db = await getDb()

        if (all) {
            await db.collection('ba_notifications').updateMany({ user_id: authUserId, is_read: false }, { $set: { is_read: true } })
        } else if (id) {
            await db.collection('ba_notifications').updateOne({ _id: id as any, user_id: authUserId }, { $set: { is_read: true } })
        } else {
            res.status(400).json({ error: 'id or all is required' })
            return
        }

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
