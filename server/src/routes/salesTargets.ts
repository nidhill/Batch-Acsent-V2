import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

// SRS Doc 2 §5 "Sales Performance" — Monthly Targets + Achievement %. One target document per
// (sales_id, month), month as 'YYYY-MM'. Achievement % is computed client-side against the
// same period's revenue from /api/analytics/overview rather than duplicated here.
// ---- Ported from src/app/api/sales-targets/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const month = (req.query.month as string) || new Date().toISOString().slice(0, 7)

        const db = await getDb()
        const filter: Record<string, any> = { month }
        if (profile.role === 'SALES' && profile.sales_id) filter.sales_id = profile.sales_id

        const targets = await db.collection('ba_sales_targets').find(filter).toArray()
        res.json({ targets: targets.map(t => ({ ...t, id: t._id })) })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, requireRole('ADMIN', 'CEO', 'SALES_HEAD', 'BUSINESS_HEAD'), async (req, res, next) => {
    try {
        const { authUserId } = req.auth!
        const { sales_id, month, target_amount, target_admissions } = req.body
        if (!sales_id || !month || target_amount === undefined) {
            res.status(400).json({ error: 'sales_id, month and target_amount are required' })
            return
        }

        const db = await getDb()
        const now = new Date().toISOString()
        await db.collection('ba_sales_targets').updateOne(
            { sales_id, month },
            {
                $set: {
                    sales_id, month,
                    target_amount: parseFloat(target_amount) || 0,
                    target_admissions: target_admissions ? parseInt(target_admissions) : null,
                    updated_at: now,
                    set_by: authUserId,
                },
                $setOnInsert: { _id: `${sales_id}-${month}` as any, created_at: now },
            },
            { upsert: true }
        )

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
