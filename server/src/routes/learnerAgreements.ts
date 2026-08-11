import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate, requireRole } from '../middleware/auth'
import { logMongoActivity } from '../lib/mongoActivity'
import { sendEmail } from '../lib/email'
import { getAgreementHtml, getAgreementSections, courseTypeLabel, type CourseType } from '../lib/learnerAgreementContent'

const router = Router()
const VALID = ['opened', 'signed']
const SEND_ROLES = ['ADMIN', 'CEO', 'SHO', 'SSHO', 'ACADEMIC_LEAD'] as const

function agreementLink(admissionId: string) {
    const appUrl = process.env.APP_URL || ''
    return `${appUrl}/agreement/${admissionId}`
}

function resolveCourseType(batch: any): CourseType {
    return batch?.course_type === 'short' ? 'short' : 'main'
}

// Shared by the manual "Send Agreement" button and the auto-send-on-verify
// hook in admissions.ts — both need the exact same "create/refresh the
// tracking doc + email the sign link" behavior.
export async function sendLearnerAgreementEmail(admissionId: string, sentBy: string | null) {
    const db = await getDb()
    const admission = await db.collection('ba_admissions').findOne({ _id: admissionId as any })
    if (!admission) throw new Error('Student not found')
    const batch = await db.collection('ba_batches').findOne({ _id: admission.batch_id as any })
    if (!batch) throw new Error('Batch not found')
    const courseType = resolveCourseType(batch)

    const link = agreementLink(admissionId)
    const now = new Date().toISOString()
    const existing = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })

    if (existing) {
        // Never regress an already-signed agreement back to "sent".
        if (existing.status !== 'signed') {
            await db.collection('ba_learner_agreements').updateOne(
                { admission_id: admissionId },
                { $set: { status: 'sent', sent_at: now, sent_by: sentBy, document_url: link, course_type: courseType } }
            )
        }
    } else {
        await db.collection('ba_learner_agreements').insertOne({
            _id: randomUUID() as any,
            admission_id: admissionId,
            status: 'sent',
            sent_at: now,
            sent_by: sentBy,
            opened_at: null,
            signed_at: null,
            document_url: link,
            course_type: courseType,
        })
    }

    if (!existing || existing.status !== 'signed') {
        await sendEmail({
            to: admission.student_email,
            subject: `HACA Learner Agreement — ${courseTypeLabel(courseType)}`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#111;">Learner Agreement — Action Required</h2>
                    <p style="color:#374151;">Hi ${admission.student_name}, please review and sign your Learner Agreement for <strong>${batch.name}</strong> before your course begins.</p>
                    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; Sign Agreement</a></p>
                </div>
            `,
        })
    }

    return { link, courseType, admission, batch }
}

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

router.post('/', authenticate, requireRole(...SEND_ROLES), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { admission_id } = req.body
        if (!admission_id) {
            res.status(400).json({ error: 'admission_id is required' })
            return
        }

        const { link, courseType, admission } = await sendLearnerAgreementEmail(admission_id, authUserId)

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'LEARNER_AGREEMENT_SENT', details: { admission_id, student_name: admission.student_name, course_type: courseType },
        })

        res.json({ success: true, status: 'sent', sent_at: new Date().toISOString(), link })
    } catch (err: any) {
        if (err.message === 'Student not found' || err.message === 'Batch not found') {
            res.status(404).json({ error: err.message })
            return
        }
        next(err)
    }
})

// POST /api/learner-agreements/:admissionId/remind — nudge a student who was
// sent the agreement but hasn't signed yet. Reuses the same email; doesn't
// touch status/sent_at so "who's overdue" tracking stays based on the
// original send, not the reminder.
router.post('/:admissionId/remind', authenticate, requireRole(...SEND_ROLES), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const admissionId = req.params.admissionId as string
        const db = await getDb()

        const agreement = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })
        if (!agreement || agreement.status === 'not_sent') {
            res.status(400).json({ error: 'Send the agreement before reminding' })
            return
        }
        if (agreement.status === 'signed') {
            res.status(400).json({ error: 'This agreement has already been signed' })
            return
        }

        const admission = await db.collection('ba_admissions').findOne({ _id: admissionId as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }
        const batch = await db.collection('ba_batches').findOne({ _id: admission.batch_id as any })
        const courseType = resolveCourseType(batch)
        const link = agreement.document_url || agreementLink(admissionId)

        await sendEmail({
            to: admission.student_email,
            subject: `Reminder: Sign your HACA Learner Agreement`,
            html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
                    <h2 style="color:#111;">Reminder — Learner Agreement Pending</h2>
                    <p style="color:#374151;">Hi ${admission.student_name}, we noticed you haven't signed your Learner Agreement for <strong>${batch?.name || ''}</strong> yet. Please complete it as soon as possible.</p>
                    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">Review &amp; Sign Agreement</a></p>
                </div>
            `,
        })

        const now = new Date().toISOString()
        await db.collection('ba_learner_agreements').updateOne(
            { admission_id: admissionId },
            { $set: { last_reminded_at: now, last_reminded_by: authUserId } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'LEARNER_AGREEMENT_REMINDED', details: { admission_id: admissionId, student_name: admission.student_name, course_type: courseType },
        })

        res.json({ success: true, reminded_at: now })
    } catch (err) {
        next(err)
    }
})

// ---- Public, no-login endpoints for the student-facing sign page ----

// GET /api/learner-agreements/public/:admissionId
router.get('/public/:admissionId', async (req, res, next) => {
    try {
        const admissionId = req.params.admissionId as string
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: admissionId as any })
        if (!admission) {
            res.status(404).json({ error: 'This agreement link is invalid.' })
            return
        }
        const batch = await db.collection('ba_batches').findOne({ _id: admission.batch_id as any })
        const courseType = resolveCourseType(batch)
        const agreement = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })

        if (!agreement || agreement.status === 'not_sent') {
            res.status(404).json({ error: 'This agreement has not been sent yet.' })
            return
        }

        res.json({
            studentName: admission.student_name,
            batchName: batch?.name || '',
            courseType,
            courseTypeLabel: courseTypeLabel(courseType),
            sections: getAgreementSections(courseType),
            status: agreement.status,
            signedAt: agreement.signed_at || null,
            signatureName: agreement.signature_name || null,
            admissionForm: agreement.admission_form || null,
            prefill: {
                fullName: admission.student_name || '',
                email: admission.student_email || '',
                contactNumber: admission.student_phone || '',
                courseName: batch?.course || '',
                modeOfStudy: batch?.mode || '',
            },
        })

        if (agreement.status === 'sent') {
            db.collection('ba_learner_agreements')
                .updateOne({ admission_id: admissionId }, { $set: { status: 'opened', opened_at: new Date().toISOString() } })
                .catch(() => { /* best-effort — the page already has what it needs */ })
        }
    } catch (err) {
        next(err)
    }
})

// Mirrors the "HACA Learners Admission Form" fields (Sections 1-6 of the
// source document). Required unconditionally; the "*Other" fields are only
// required when their matching select is set to "Other".
const REQUIRED_ADMISSION_FORM_FIELDS = [
    'fullName', 'dateOfBirth', 'gender', 'contactNumber', 'email', 'address',
    'highestQualification', 'institutionName', 'yearOfPassing',
    'courseName', 'preferredBatchTiming', 'modeOfStudy',
    'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactNumber',
    'registrationFeePaid', 'paymentMode',
    'identityProofType', 'identityProofNumber', 'uploadCopyOfIdentityProof',
] as const

function validateAdmissionForm(form: any): string | null {
    if (!form || typeof form !== 'object') return 'Please fill in the admission form.'
    for (const field of REQUIRED_ADMISSION_FORM_FIELDS) {
        if (!String(form[field] ?? '').trim()) return `Please fill in all admission form fields (missing: ${field}).`
    }
    if (form.paymentMode === 'Other' && !String(form.paymentModeOther ?? '').trim()) {
        return 'Please specify the payment mode.'
    }
    if (form.identityProofType === 'Other' && !String(form.identityProofTypeOther ?? '').trim()) {
        return 'Please specify the identity proof type.'
    }
    return null
}

// POST /api/learner-agreements/public/:admissionId/sign
router.post('/public/:admissionId/sign', async (req, res, next) => {
    try {
        const admissionId = req.params.admissionId as string
        const signatureName = String(req.body?.signatureName || '').trim()
        if (!signatureName) {
            res.status(400).json({ error: 'Please type your full name to sign' })
            return
        }
        const formError = validateAdmissionForm(req.body?.admissionForm)
        if (formError) {
            res.status(400).json({ error: formError })
            return
        }

        const db = await getDb()
        const agreement = await db.collection('ba_learner_agreements').findOne({ admission_id: admissionId })
        if (!agreement || agreement.status === 'not_sent') {
            res.status(400).json({ error: 'This agreement has not been sent yet.' })
            return
        }
        if (agreement.status === 'signed') {
            res.status(400).json({ error: 'This agreement has already been signed.' })
            return
        }

        const now = new Date().toISOString()
        await db.collection('ba_learner_agreements').updateOne(
            { admission_id: admissionId },
            { $set: { status: 'signed', signed_at: now, signature_name: signatureName, admission_form: req.body.admissionForm } }
        )

        const admission = await db.collection('ba_admissions').findOne({ _id: admissionId as any })
        await logMongoActivity({
            request: req, userId: 'public', userName: admission?.student_name || 'Student', userEmail: admission?.student_email || null, userRole: 'STUDENT',
            action: 'LEARNER_AGREEMENT_SIGNED', details: { admission_id: admissionId, signature_name: signatureName },
        })

        res.json({ success: true, status: 'signed', signed_at: now })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/learner-agreements/[admissionId]/status/route.ts ----
router.post('/:admissionId/status', authenticate, requireRole(...SEND_ROLES), async (req, res, next) => {
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
