import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// SRS Doc 4 §9: batch transfers go through an approval workflow instead of being instant.
// Admin/CEO keep the direct-transfer capability on /api/admissions/:id/transfer (approvers of
// last resort); everyone else creates a request here.
// ---- Ported from src/app/api/batch-transfer-requests/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const status = (req.query.status as string) || 'pending'

        const db = await getDb()
        const requests = await db.collection('ba_batch_transfer_requests').find({ status }).sort({ requested_at: -1 }).toArray()

        const admissionIds = requests.map(r => r.admission_id)
        const admissions = admissionIds.length > 0
            ? await db.collection('ba_admissions').find({ _id: { $in: admissionIds } }).toArray()
            : []
        const admissionMap = new Map(admissions.map(a => [a._id, a]))

        const batchIds = Array.from(new Set(requests.flatMap(r => [r.from_batch_id, r.to_batch_id])))
        const batches = batchIds.length > 0
            ? await db.collection('ba_batches').find({ _id: { $in: batchIds as any[] } }).project({ name: 1 }).toArray()
            : []
        const batchNameMap = new Map(batches.map(b => [String(b._id), b.name]))

        const result = requests.map(r => ({
            ...r, id: r._id,
            student: admissionMap.get(r.admission_id),
            from_batch_name: batchNameMap.get(r.from_batch_id),
            to_batch_name: batchNameMap.get(r.to_batch_id),
        }))
        res.json({ requests: result })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { admission_id, to_batch_id } = req.body
        if (!admission_id || !to_batch_id) {
            res.status(400).json({ error: 'admission_id and to_batch_id are required' })
            return
        }

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: admission_id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const destBatch = await db.collection('ba_batches').findOne({ _id: to_batch_id as any })
        if (!destBatch) {
            res.status(404).json({ error: 'Destination batch not found' })
            return
        }

        const now = new Date().toISOString()
        const doc = {
            _id: randomUUID() as any,
            admission_id,
            from_batch_id: admission.batch_id,
            to_batch_id,
            requested_by: authUserId,
            requested_by_role: profile.role,
            status: 'pending',
            requested_at: now,
        }
        await db.collection('ba_batch_transfer_requests').insertOne(doc)

        await db.collection('ba_admissions').updateOne(
            { _id: admission_id as any },
            { $set: { action_type: 'transfer_request', verification_status: 'pending' } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_TRANSFER_REQUESTED', details: { admission_id, from_batch: admission.batch_id, to_batch: to_batch_id },
        })

        res.json({ success: true, request: doc })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batch-transfer-requests/[id]/approve/route.ts ----
router.post('/:id/approve', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        const db = await getDb()

        const transferRequest = await db.collection('ba_batch_transfer_requests').findOne({ _id: id as any })
        if (!transferRequest) {
            res.status(404).json({ error: 'Transfer request not found' })
            return
        }
        if (transferRequest.status !== 'pending') {
            res.status(409).json({ error: `Request already ${transferRequest.status}` })
            return
        }

        const admission = await db.collection('ba_admissions').findOne({ _id: transferRequest.admission_id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const destBatch = await db.collection('ba_batches').findOne({ _id: transferRequest.to_batch_id as any })
        if (!destBatch) {
            res.status(404).json({ error: 'Destination batch not found' })
            return
        }

        const now = new Date().toISOString()

        await db.collection('ba_admissions').updateOne(
            { _id: transferRequest.admission_id as any },
            { $set: { batch_id: transferRequest.to_batch_id, verification_status: 'verified', action_type: 'new_admission' } }
        )
        await db.collection('ba_student_batches').updateMany(
            { student_email: admission.student_email, batch_id: transferRequest.from_batch_id },
            { $set: { batch_id: transferRequest.to_batch_id } }
        )
        if (admission.onboarding_completed) {
            await db.collection('ba_students').updateMany(
                { email: admission.student_email, batch_id: transferRequest.from_batch_id },
                { $set: { batch_id: transferRequest.to_batch_id } }
            )
        }

        await db.collection('ba_batch_transfer_requests').updateOne(
            { _id: id as any },
            { $set: { status: 'approved', reviewed_by: authUserId, reviewed_at: now } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_TRANSFER_APPROVED', details: { admission_id: transferRequest.admission_id, to_batch_name: destBatch.name },
        })

        res.json({ success: true, batch_name: destBatch.name })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batch-transfer-requests/[id]/reject/route.ts ----
router.post('/:id/reject', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        const reason = req.body?.reason || ''

        const db = await getDb()
        const transferRequest = await db.collection('ba_batch_transfer_requests').findOne({ _id: id as any })
        if (!transferRequest) {
            res.status(404).json({ error: 'Transfer request not found' })
            return
        }
        if (transferRequest.status !== 'pending') {
            res.status(409).json({ error: `Request already ${transferRequest.status}` })
            return
        }

        const now = new Date().toISOString()
        await db.collection('ba_batch_transfer_requests').updateOne(
            { _id: id as any },
            { $set: { status: 'rejected', reject_reason: reason || null, reviewed_by: authUserId, reviewed_at: now } }
        )
        await db.collection('ba_admissions').updateOne(
            { _id: transferRequest.admission_id as any },
            { $set: { action_type: 'new_admission', verification_status: 'verified' } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_TRANSFER_REJECTED', details: { admission_id: transferRequest.admission_id, reason },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
