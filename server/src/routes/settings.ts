import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate, requireRole } from '../middleware/auth'
import { getLmsAccessPolicy } from '../lib/lmsAccessPolicy'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// ---- Ported from src/app/api/settings/lms-access-policy/route.ts ----
router.get('/lms-access-policy', authenticate, async (req, res, next) => {
    try {
        const policy = await getLmsAccessPolicy()
        res.json({ policy })
    } catch (err) {
        next(err)
    }
})

router.put('/lms-access-policy', authenticate, requireRole('ADMIN', 'CEO', 'BUSINESS_HEAD'), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { rule_type, min_percentage } = req.body
        if (!['full_payment', 'min_percentage', 'any_payment'].includes(rule_type)) {
            res.status(400).json({ error: 'Invalid rule_type' })
            return
        }
        if (rule_type === 'min_percentage' && (typeof min_percentage !== 'number' || min_percentage < 0 || min_percentage > 100)) {
            res.status(400).json({ error: 'min_percentage must be a number between 0 and 100' })
            return
        }

        const db = await getDb()
        const now = new Date().toISOString()
        await db.collection('ba_settings').updateOne(
            { _id: 'lms_access_policy' as any },
            { $set: { rule_type, min_percentage: min_percentage || 0, updated_at: now, updated_by: authUserId } },
            { upsert: true }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'LMS_ACCESS_POLICY_UPDATED', details: { rule_type, min_percentage },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
