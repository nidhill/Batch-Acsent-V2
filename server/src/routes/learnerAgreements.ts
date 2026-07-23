import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate, requireRole } from '../middleware/auth'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()
const VALID = ['opened', 'signed']

// ---- Ported from src/app/api/learner-agreements/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const admissionId = req.query.admission_id as string | undefined
        if (!admissionId) {
            res.status(400).json({ error: 'admission_id is required' })
            return
        }

        const db = await getDb()
        const agreement = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })
        res.json({ agreement: agreement ? { ...agreement, id: agreement._id } : { status: 'not_sent', admission_id: admissionId } })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, requireRole('ADMIN', 'CEO', 'SHO', 'SSHO', 'ACADEMIC_LEAD'), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { admission_id, document_url } = req.body
        if (!admission_id) {
            res.status(400).json({ error: 'admission_id is required' })
            return
        }

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: admission_id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const now = new Date().toISOString()
        const existing = await db.collection('ba_learner_agreements').findOne({ admission_id })

        if (existing) {
            await db.collection('ba_learner_agreements').updateOne(
                { admission_id },
                { $set: { status: 'sent', sent_at: now, sent_by: authUserId, document_url: document_url || existing.document_url || null } }
            )
        } else {
            await db.collection('ba_learner_agreements').insertOne({
                _id: randomUUID() as any,
                admission_id,
                status: 'sent',
                sent_at: now,
                sent_by: authUserId,
                opened_at: null,
                signed_at: null,
                document_url: document_url || null,
            })
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'LEARNER_AGREEMENT_SENT', details: { admission_id, student_name: admission.student_name },
        })

        res.json({ success: true, status: 'sent', sent_at: now })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/learner-agreements/[admissionId]/status/route.ts ----
router.post('/:admissionId/status', authenticate, requireRole('ADMIN', 'CEO', 'SHO', 'SSHO', 'ACADEMIC_LEAD'), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const admissionId = req.params.admissionId as string
        const { status } = req.body
        if (!VALID.includes(status)) {
            res.status(400).json({ error: `status must be one of ${VALID.join(', ')}` })
            return
        }

        const db = await getDb()
        const agreement = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })
        if (!agreement || agreement.status === 'not_sent') {
            res.status(400).json({ error: 'Agreement must be sent before it can be opened/signed' })
            return
        }

        const now = new Date().toISOString()
        const update: Record<string, any> = { status }
        if (status === 'opened') update.opened_at = now
        if (status === 'signed') update.signed_at = now

        await db.collection('ba_learner_agreements').updateOne({ admission_id: admissionId }, { $set: update })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: status === 'signed' ? 'LEARNER_AGREEMENT_SIGNED' : 'LEARNER_AGREEMENT_OPENED', details: { admission_id: admissionId },
        })

        res.json({ success: true, status, timestamp: now })
    } catch (err) {
        next(err)
    }
})

export default router
