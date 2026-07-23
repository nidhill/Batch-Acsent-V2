import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'

const router = Router()

// SRS Doc 4 §7: a dedicated verification queue covering new admissions, post-start
// additions, and transfer requests — replacing the old inline "Verify Now" button as
// the primary Academic Lead workflow.
// ---- Ported from src/app/api/verification-queue/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const db = await getDb()
        const isSuperUser = profile.role === 'ADMIN' || profile.role === 'CEO'

        const filter: Record<string, any> = {
            $or: [{ verified_at: { $exists: false } }, { verified_at: null }],
            status: { $ne: 'Rejected' },
        }

        let batchScope: string[] | null = null
        if (!isSuperUser && profile.school) {
            const schoolBatches = await db.collection('ba_batches').find({ school: profile.school }).project({ _id: 1 }).toArray()
            batchScope = schoolBatches.map(b => String(b._id))
            filter.batch_id = { $in: batchScope }
        }

        const pending = await db.collection('ba_admissions').find(filter).sort({ linked_at: -1 }).toArray()

        const batchIds = Array.from(new Set(pending.map(a => a.batch_id).filter(Boolean)))
        const batches = batchIds.length > 0
            ? await db.collection('ba_batches').find({ _id: { $in: batchIds as any[] } }).project({ name: 1, course: 1 }).toArray()
            : []
        const batchMap = new Map(batches.map(b => [String(b._id), b]))

        const salesIds = Array.from(new Set(pending.map(a => a.sales_id).filter(Boolean)))
        const salesUsers = salesIds.length > 0
            ? await db.collection('ba_users').find({ $or: [{ _id: { $in: salesIds as any[] } }, { sales_id: { $in: salesIds } }] }).project({ name: 1, sales_id: 1 }).toArray()
            : []
        const salesMap = new Map<string, any>()
        salesUsers.forEach(u => { if (u.sales_id) salesMap.set(u.sales_id, u); salesMap.set(String(u._id), u) })

        const admissionIds = pending.map(a => a._id)
        const payments = admissionIds.length > 0
            ? await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            : []
        const paymentMap = new Map(payments.map(p => [p.admission_id, p]))

        const items = pending.map(a => {
            const batch = batchMap.get(a.batch_id)
            const payment = paymentMap.get(a._id)
            return {
                id: a._id,
                student_name: a.student_name,
                student_email: a.student_email,
                student_phone: a.student_phone,
                batch_id: a.batch_id,
                batch_name: batch?.name,
                course: batch?.course,
                sales_executive: salesMap.get(a.sales_id)?.name || a.sales_id,
                action_type: a.action_type || 'new_admission',
                added_by_role: a.added_by_role || null,
                verification_status: a.verification_status || 'pending',
                changes_requested_message: a.changes_requested_message || null,
                linked_at: a.linked_at,
                payment_status: payment
                    ? (payment.remaining_amount <= 0 ? 'Cleared' : 'Pending')
                    : 'Restricted',
            }
        })

        // Pending batch-transfer requests, same scope
        const transferFilter: Record<string, any> = { status: 'pending' }
        const transferRequests = await db.collection('ba_batch_transfer_requests').find(transferFilter).sort({ requested_at: -1 }).toArray()
        const scopedTransfers = batchScope
            ? transferRequests.filter(r => batchScope!.includes(r.from_batch_id) || batchScope!.includes(r.to_batch_id))
            : transferRequests

        res.json({ items, transfer_requests_count: scopedTransfers.length })
    } catch (err) {
        next(err)
    }
})

export default router
