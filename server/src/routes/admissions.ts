import { Router } from 'express'
import multer from 'multer'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { notifyUsers, findUserIdsByRole } from '../lib/notify'
import { logMongoActivity } from '../lib/mongoActivity'
import { getLmsAccessPolicy, evaluateLmsAccess } from '../lib/lmsAccessPolicy'
import { getSupabaseAdmin, ensureDocumentsBucket, ADMISSION_DOCUMENTS_BUCKET } from '../lib/supabaseAdmin'
import { isDisposableOrFakeEmail } from '../lib/emailValidation'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Age is derived here rather than trusted from the client — the form already computes it
// client-side for the "Age: N years" preview under the Date of Birth field, but the stored
// value should reflect dob as of admission, not whatever number happened to be in the request.
function calculateAge(dob: string): number | null {
    const birth = new Date(dob)
    if (isNaN(birth.getTime())) return null
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
    return age
}

// ---- Ported from src/app/api/admissions/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const batchId = req.query.batch_id as string | undefined
        const batchIdsParam = req.query.batch_ids as string | undefined
        const salesId = req.query.sales_id as string | undefined
        const search = req.query.q as string | undefined
        const from = req.query.from as string | undefined
        const to = req.query.to as string | undefined
        const limit = parseInt((req.query.limit as string) || '0') || undefined

        const db = await getDb()
        const filter: Record<string, any> = {}
        if (batchId) filter.batch_id = batchId
        if (batchIdsParam) filter.batch_id = { $in: batchIdsParam.split(',').filter(Boolean) }
        if (salesId) filter.sales_id = salesId
        if (from || to) {
            filter.enrolled_at = {}
            if (from) filter.enrolled_at.$gte = from
            if (to) filter.enrolled_at.$lte = to
        }

        if (search && can(profile.role, 'VIEW_ALL_SCHOOLS')) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
            filter.$or = [{ student_name: rx }, { student_email: rx }, { student_phone: rx }]
        }

        if (profile.role === 'SALES') {
            filter.sales_id = profile.sales_id
        }

        let cursor = db.collection('ba_admissions').find(filter).sort({ enrolled_at: -1, linked_at: -1 })
        if (limit) cursor = cursor.limit(limit)
        else if (search) cursor = cursor.limit(25)
        const admissions = await cursor.toArray()

        const batchIds = Array.from(new Set(admissions.map(a => a.batch_id).filter(Boolean)))
        const batches = batchIds.length > 0
            ? await db.collection('ba_batches').find({ _id: { $in: batchIds as any[] } }).project({ name: 1 }).toArray()
            : []
        const batchNameMap = new Map(batches.map(b => [String(b._id), b.name]))

        const admissionIds = admissions.map(a => a._id)
        const payments = admissionIds.length > 0
            ? await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            : []
        const paymentMap = new Map(payments.map(p => [p.admission_id, p]))
        const canSeePayments = can(profile.role, 'VIEW_PAYMENT_DETAILS')

        const result = admissions.map(a => {
            const payment = paymentMap.get(a._id)
            const payment_clearance_status = payment
                ? (payment.remaining_amount <= 0 ? 'Cleared' : 'Pending')
                : 'Restricted'
            return {
                ...a,
                id: a._id,
                batch_name: batchNameMap.get(a.batch_id),
                payment_clearance_status,
                payment: canSeePayments ? payment : undefined,
            }
        })
        res.json({ admissions: result })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!['ADMIN', 'CEO', 'SALES', 'SALES_HEAD'].includes(profile.role)) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const {
            batch_id, student_name, student_email, student_phone, whatsapp_number, sales_id, sales_user_id,
            dob, age, gender, city, state, region,
            guardian_name, guardian_contact, address,
            lead_source, admission_date, lead_creation_date,
            discount, scholarship, payment_status, payment_method, payment_channel,
            amount_paid, next_due_date, installment_number, transaction_number, receipt_number, remarks,
        } = req.body
        // Kept in sync with the "required" fields on the client form — scholarship,
        // transaction_number, receipt_number and remarks are the only fields that stay optional.
        const requiredFields: Record<string, any> = {
            batch_id, student_name, student_email, student_phone, whatsapp_number,
            age, gender, city, state, region, guardian_name, guardian_contact, address,
            lead_source, admission_date, lead_creation_date,
            payment_status, payment_method, payment_channel, amount_paid,
        }
        const missing = Object.entries(requiredFields).filter(([, v]) => v === undefined || v === null || v === '').map(([k]) => k)
        if (payment_status !== 'full' && !next_due_date) missing.push('next_due_date')
        if (discount === undefined || discount === null || discount === '') missing.push('discount')
        if (missing.length > 0) {
            res.status(400).json({ error: `Missing required field(s): ${missing.join(', ')}` })
            return
        }

        if (isDisposableOrFakeEmail(student_email)) {
            res.status(400).json({ error: 'Please enter a real, working email address for the student — temporary/fake email domains are not allowed.' })
            return
        }

        const db = await getDb()

        // Hard block, not just a warning: the same email or mobile number must not be able to
        // create a second admission record. Checked here (not only client-side) since this is
        // the one place that can't be bypassed.
        const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const normalizedEmail = student_email.trim().toLowerCase()
        const normalizedPhone = (student_phone || '').trim()
        const dupOr: Record<string, any>[] = [{ student_email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, 'i') }]
        if (normalizedPhone) dupOr.push({ student_phone: normalizedPhone })
        const existing = await db.collection('ba_admissions').findOne({ $or: dupOr })
        if (existing) {
            const field = existing.student_email && String(existing.student_email).toLowerCase() === normalizedEmail ? 'email address' : 'mobile number'
            res.status(409).json({ error: `A student with this ${field} already exists (${existing.student_name}). Duplicate admissions are not allowed.` })
            return
        }

        const batch = await db.collection('ba_batches').findOne({ _id: batch_id as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        // Sales attribution: a SALES user is auto-credited via their own profile. ADMIN/CEO/
        // SALES_HEAD generally have no sales_id of their own, so when one of them submits this
        // form they must explicitly pick which Sales Executive gets credit — required, not
        // optional, since an unattributed admission (empty sales_id) is invisible to every
        // leaderboard/target/revenue-by-rep view.
        let resolvedSalesId: string | null = profile.sales_id || null
        if (sales_user_id) {
            const salesPerson = await db.collection('ba_users').findOne({ _id: sales_user_id as any })
            if (!salesPerson) {
                res.status(400).json({ error: 'Selected Sales Executive not found' })
                return
            }
            resolvedSalesId = salesPerson.sales_id || salesPerson._id
        } else if (sales_id) {
            resolvedSalesId = sales_id
        }
        if (profile.role !== 'SALES' && !resolvedSalesId) {
            res.status(400).json({ error: 'Please select which Sales Executive this admission should be credited to' })
            return
        }

        if (batch.strength) {
            const currentCount = await db.collection('ba_admissions').countDocuments({ batch_id })
            if (currentCount >= batch.strength) {
                res.status(409).json({ error: `Batch "${batch.name}" is full (${currentCount}/${batch.strength}).` })
                return
            }
        }

        const todayStr = new Date().toISOString().split('T')[0]
        const actionType = batch.start_date && batch.start_date <= todayStr ? 'post_start_addition' : 'new_admission'

        const now = new Date().toISOString()
        const admissionId = randomUUID()
        const doc: any = {
            _id: admissionId as any,
            sales_id: resolvedSalesId,
            batch_id,
            student_name,
            student_email,
            student_phone: student_phone || null,
            whatsapp_number: whatsapp_number || null,
            dob: dob || null,
            age: dob ? calculateAge(dob) : (age ? parseInt(age) : null),
            gender: gender || null,
            city: city || null,
            state: state || null,
            address: address || null,
            guardian_name: guardian_name || null,
            guardian_contact: guardian_contact || null,
            region: region || batch.region || null,
            lead_source: lead_source || null,
            admission_date: admission_date || null,
            lead_creation_date: lead_creation_date || null,
            action_type: actionType,
            added_by_role: profile.role,
            verification_status: 'pending',
            enrolled_at: now,
            linked_at: now,
            status: 'Pending',
            onboarding_completed: false,
        }
        await db.collection('ba_admissions').insertOne(doc)

        const courseFee = batch.course_fee || 0
        const finalFee = Math.max(0, courseFee - (parseFloat(discount) || 0) - (parseFloat(scholarship) || 0))
        const paidNow = parseFloat(amount_paid) || 0
        const paymentDoc = {
            _id: randomUUID() as any,
            admission_id: admissionId,
            course_fee: courseFee,
            discount: parseFloat(discount) || 0,
            scholarship: parseFloat(scholarship) || 0,
            final_fee: finalFee,
            amount_paid: paidNow,
            remaining_amount: Math.max(0, finalFee - paidNow),
            payment_status: payment_status || 'partial',
            created_at: now,
            updated_at: now,
        }
        await db.collection('ba_payments').insertOne(paymentDoc)

        if (paidNow > 0 || payment_method) {
            await db.collection('ba_payment_transactions').insertOne({
                _id: randomUUID() as any,
                payment_id: paymentDoc._id,
                admission_id: admissionId,
                amount: paidNow,
                method: payment_method || null,
                channel: payment_channel || null,
                transaction_number: transaction_number || null,
                receipt_number: receipt_number || null,
                remarks: remarks || null,
                next_due_date: next_due_date || null,
                installment_number: installment_number || 1,
                recorded_by: profile._id,
                paid_at: now,
            })
        }

        const academicLeadIds = await findUserIdsByRole(['ACADEMIC_LEAD'], batch.school)
        await notifyUsers({
            userIds: academicLeadIds,
            type: 'student_admitted',
            title: 'New student pending verification',
            message: `${student_name} was added to ${batch.name} and needs verification.`,
            link: `/dashboard/verification-queue`,
        })

        const newCount = await db.collection('ba_admissions').countDocuments({ batch_id })
        if (batch.strength && newCount >= batch.strength) {
            const notifyIds = await findUserIdsByRole(['SALES_HEAD', 'BUSINESS_HEAD'], batch.school)
            await notifyUsers({
                userIds: notifyIds,
                type: 'batch_full',
                title: 'Batch is now full',
                message: `${batch.name} has reached capacity (${newCount}/${batch.strength}).`,
                link: `/dashboard/batch/${batch_id}`,
            })
        }

        res.json({ success: true, admission: { ...doc, id: doc._id }, payment: paymentDoc })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/stats/route.ts ----
router.get('/stats', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const db = await getDb()

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)
        const startOfMonthIso = startOfMonth.toISOString()

        let filter: Record<string, any> = {}

        if (profile.role === 'SALES_HEAD' && profile.school) {
            const schoolBatches = await db.collection('ba_batches').find({ school: profile.school }).project({ _id: 1 }).toArray()
            const batchIds = schoolBatches.map(b => b._id)
            filter = { batch_id: { $in: batchIds } }
        } else if (profile.sales_id) {
            filter = { sales_id: profile.sales_id }
        } else {
            res.json({ total_enrollments: 0, this_month: 0 })
            return
        }

        const total_enrollments = await db.collection('ba_admissions').countDocuments(filter)
        const this_month = await db.collection('ba_admissions').countDocuments({ ...filter, enrolled_at: { $gte: startOfMonthIso } })

        res.json({ total_enrollments, this_month })
    } catch (err) {
        next(err)
    }
})

// New: lets the Student Admission form warn the person filling it in when the email/mobile
// they just typed already belongs to an existing admission, before they submit a duplicate.
// Checked globally (not scoped to the caller's school/sales_id) since the same student could
// have already been entered by a different rep or school.
router.get('/check-duplicate', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!['ADMIN', 'CEO', 'SALES', 'SALES_HEAD'].includes(profile.role)) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const email = ((req.query.email as string) || '').trim().toLowerCase()
        const phone = ((req.query.phone as string) || '').trim()
        if (!email && !phone) {
            res.json({ matches: [] })
            return
        }

        const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const or: Record<string, any>[] = []
        if (email) or.push({ student_email: new RegExp(`^${escapeRegex(email)}$`, 'i') })
        if (phone) or.push({ student_phone: phone })

        const db = await getDb()
        const matches = await db.collection('ba_admissions')
            .find({ $or: or })
            .project({ student_name: 1, student_email: 1, student_phone: 1, batch_id: 1, enrolled_at: 1 })
            .limit(5)
            .toArray()

        const batchIds = Array.from(new Set(matches.map(m => m.batch_id).filter(Boolean)))
        const batches = batchIds.length > 0
            ? await db.collection('ba_batches').find({ _id: { $in: batchIds as any[] } }).project({ name: 1 }).toArray()
            : []
        const batchNameMap = new Map(batches.map(b => [String(b._id), b.name]))

        res.json({
            matches: matches.map(m => ({
                student_name: m.student_name,
                student_email: m.student_email,
                student_phone: m.student_phone,
                batch_name: batchNameMap.get(m.batch_id) || null,
                enrolled_at: m.enrolled_at || null,
                matched_field: email && String(m.student_email).toLowerCase() === email ? 'email' : 'phone',
            })),
        })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/route.ts ----
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const { id } = req.params
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        if (profile.role === 'SALES' && admission.sales_id !== profile.sales_id) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const [batch, payment, logs] = await Promise.all([
            db.collection('ba_batches').findOne({ _id: admission.batch_id }),
            db.collection('ba_payments').findOne({ admission_id: id }),
            db.collection('ba_activity_logs')
                .find({ $or: [{ 'details.admission_id': id }, { 'details.student_email': admission.student_email }] })
                .sort({ created_at: -1 })
                .limit(100)
                .toArray(),
        ])

        const canSeePayments = can(profile.role, 'VIEW_PAYMENT_DETAILS')
        const transactions = payment && canSeePayments
            ? await db.collection('ba_payment_transactions').find({ payment_id: payment._id }).sort({ paid_at: -1 }).toArray()
            : []
        const lmsPolicy = await getLmsAccessPolicy()

        res.json({
            admission: { ...admission, id: admission._id },
            batch: batch ? { ...batch, id: batch._id } : null,
            payment: canSeePayments ? payment : null,
            payment_clearance_status: payment ? (payment.remaining_amount <= 0 ? 'Cleared' : 'Pending') : 'Restricted',
            transactions: canSeePayments ? transactions : [],
            activity: logs,
            lms_access_granted: evaluateLmsAccess(lmsPolicy, payment as any),
            lms_access_policy: lmsPolicy,
        })
    } catch (err) {
        next(err)
    }
})

router.patch('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { id } = req.params
        const { student_email } = req.body || {}
        if (!student_email || !student_email.includes('@')) {
            res.status(400).json({ error: 'Please provide a valid email' })
            return
        }

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        await db.collection('ba_admissions').updateOne({ _id: id as any }, { $set: { student_email } })

        if (admission.onboarding_completed) {
            await db.collection('ba_students').updateOne(
                { email: admission.student_email, batch_id: admission.batch_id },
                { $set: { email: student_email } }
            )
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_EMAIL_UPDATED', details: { admission_id: id, old_email: admission.student_email, new_email: student_email },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'DELETE_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        await db.collection('ba_deleted_log').insertOne({
            _id: `${id}-${Date.now()}` as any,
            table_name: 'ba_admissions',
            record_id: id,
            record_data: admission,
            deleted_at: new Date().toISOString(),
            deleted_by: authUserId,
        })

        await db.collection('ba_admissions').deleteOne({ _id: id as any })
        await db.collection('ba_student_batches').deleteMany({ student_email: admission.student_email, batch_id: admission.batch_id })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_REMOVED', details: { student_email: admission.student_email, batch_id: admission.batch_id },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/call/route.ts ----
router.post('/:id/call', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'CALL_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params
        const { undo } = req.body || {}
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const called_at = undo ? null : new Date().toISOString()
        await db.collection('ba_admissions').updateOne({ _id: id as any }, { $set: { called_at } })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: undo ? 'STUDENT_CALL_UNDO' : 'STUDENT_CALLED', details: { student_id: id, batch_id: admission.batch_id },
        })

        res.json({ success: true, called_at })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/documents/route.ts ----
router.post('/:id/documents', authenticate, upload.single('file'), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!['ADMIN', 'CEO', 'SALES', 'SALES_HEAD', 'ACADEMIC_LEAD'].includes(profile.role)) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }
        if (profile.role === 'SALES' && admission.sales_id !== profile.sales_id) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const ALLOWED_TYPES = ['photo', 'id_proof', 'qualification_cert']
        const docType = req.body.type as string
        const file = req.file
        if (!docType || !ALLOWED_TYPES.includes(docType)) {
            res.status(400).json({ error: `type must be one of ${ALLOWED_TYPES.join(', ')}` })
            return
        }
        if (!file) {
            res.status(400).json({ error: 'file is required' })
            return
        }
        // multer's limits.fileSize already rejects >5MB before this point (Express emits a
        // MulterError which flows to the error handler) — no separate size check needed here.

        await ensureDocumentsBucket()
        const admin = getSupabaseAdmin()
        const ext = file.originalname.split('.').pop() || 'bin'
        const path = `${id}/${docType}-${Date.now()}.${ext}`

        const { error: uploadError } = await admin.storage
            .from(ADMISSION_DOCUMENTS_BUCKET)
            .upload(path, file.buffer, { contentType: file.mimetype, upsert: true })
        if (uploadError) throw uploadError

        await db.collection('ba_admissions').updateOne(
            { _id: id as any },
            { $set: { [`documents.${docType}`]: { path, uploaded_at: new Date().toISOString(), uploaded_by: authUserId, filename: file.originalname } } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_DOCUMENT_UPLOADED', details: { admission_id: id, document_type: docType },
        })

        res.json({ success: true, type: docType, path })
    } catch (err) {
        next(err)
    }
})

router.get('/:id/documents', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const { id } = req.params

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }
        if (profile.role === 'SALES' && admission.sales_id !== profile.sales_id) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const ALLOWED_TYPES = ['photo', 'id_proof', 'qualification_cert'] as const
        const documents = admission.documents || {}
        const admin = getSupabaseAdmin()
        const signed: Record<string, any> = {}
        for (const docType of ALLOWED_TYPES) {
            const doc = documents[docType]
            if (!doc?.path) continue
            const { data, error } = await admin.storage.from(ADMISSION_DOCUMENTS_BUCKET).createSignedUrl(doc.path, 3600)
            if (!error && data) signed[docType] = { ...doc, url: data.signedUrl }
        }

        res.json({ documents: signed })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/onboard/route.ts ----
router.post('/:id/onboard', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const { id } = req.params
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const currentlyOnboarded = !!admission.onboarding_completed
        const phoneInt = admission.student_phone ? parseInt(String(admission.student_phone).replace(/\D/g, '')) : null

        if (!currentlyOnboarded) {
            await db.collection('ba_students').insertOne({
                _id: randomUUID() as any,
                full_name: admission.student_name,
                email: admission.student_email,
                phone: phoneInt,
                batch_id: admission.batch_id,
                joined_at: new Date().toISOString(),
            })
            await db.collection('ba_admissions').updateOne({ _id: id as any }, { $set: { onboarding_completed: true } })
            await logMongoActivity({
                request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
                action: 'STUDENT_ONBOARDED', details: { student_name: admission.student_name, student_email: admission.student_email, batch_id: admission.batch_id },
            })

            const batch = await db.collection('ba_batches').findOne({ _id: admission.batch_id as any })
            const salesUser = admission.sales_id
                ? await db.collection('ba_users').findOne({ $or: [{ _id: admission.sales_id as any }, { sales_id: admission.sales_id }] })
                : null
            const businessHeadIds = await findUserIdsByRole(['BUSINESS_HEAD'], batch?.school)
            await notifyUsers({
                userIds: [...(salesUser ? [String(salesUser._id)] : []), ...businessHeadIds],
                type: 'student_onboarded',
                title: 'Student onboarded',
                message: `${admission.student_name} has completed onboarding.`,
                link: `/dashboard/batch/${admission.batch_id}`,
            })
        } else {
            await db.collection('ba_students').deleteOne({ email: admission.student_email, batch_id: admission.batch_id })
            await db.collection('ba_admissions').updateOne({ _id: id as any }, { $set: { onboarding_completed: false } })
            await logMongoActivity({
                request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
                action: 'STUDENT_ONBOARD_UNDO', details: { student_name: admission.student_name, student_email: admission.student_email, batch_id: admission.batch_id },
            })
        }

        res.json({ success: true, onboarding_completed: !currentlyOnboarded })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/reject/route.ts ----
router.post('/:id/reject', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params
        const { reason } = req.body || {}

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        await db.collection('ba_admissions').updateOne(
            { _id: id as any },
            { $set: { status: 'Rejected', verification_status: 'rejected', rejected_reason: reason || null, reviewed_by: authUserId, reviewed_at: new Date().toISOString() } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_REJECTED', details: { student_name: admission.student_name, student_email: admission.student_email, batch_id: admission.batch_id, reason },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/request-changes/route.ts ----
router.post('/:id/request-changes', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params
        const { message } = req.body || {}
        if (!message) {
            res.status(400).json({ error: 'A message describing the requested changes is required' })
            return
        }

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        await db.collection('ba_admissions').updateOne(
            { _id: id as any },
            { $set: { verification_status: 'changes_requested', changes_requested_message: message, reviewed_by: authUserId, reviewed_at: new Date().toISOString() } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_CHANGES_REQUESTED', details: { student_name: admission.student_name, student_email: admission.student_email, batch_id: admission.batch_id, message },
        })

        if (admission.sales_id) {
            const salesUsers = await db.collection('ba_users').find({ sales_id: admission.sales_id }).project({ _id: 1 }).toArray()
            await notifyUsers({
                userIds: salesUsers.map(u => String(u._id)),
                type: 'changes_requested',
                title: 'Changes requested on an admission',
                message: `${admission.student_name}: ${message}`,
                link: `/dashboard/sales/intimation`,
            })
        }

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/transfer/route.ts ----
// Instant transfer, bypassing the approval queue — restricted to Admin/CEO only. Kept as an
// inline check rather than the shared requireRole middleware so the 403 body can point
// non-admins at the approval-request flow, matching the original exactly.
router.post('/:id/transfer', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!['ADMIN', 'CEO'].includes(profile.role)) {
            res.status(403).json({ error: 'Forbidden: use /api/batch-transfer-requests instead' })
            return
        }
        const { id } = req.params
        const { to_batch_id } = req.body || {}
        if (!to_batch_id) {
            res.status(400).json({ error: 'to_batch_id is required' })
            return
        }

        const db = await getDb()
        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const destBatch = await db.collection('ba_batches').findOne({ _id: to_batch_id as any })
        if (!destBatch) {
            res.status(404).json({ error: 'Destination batch not found' })
            return
        }

        const fromBatchId = admission.batch_id

        await db.collection('ba_admissions').updateOne({ _id: id as any }, { $set: { batch_id: to_batch_id } })
        await db.collection('ba_student_batches').updateMany(
            { student_email: admission.student_email, batch_id: fromBatchId },
            { $set: { batch_id: to_batch_id } }
        )
        if (admission.onboarding_completed) {
            await db.collection('ba_students').updateMany(
                { email: admission.student_email, batch_id: fromBatchId },
                { $set: { batch_id: to_batch_id } }
            )
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_TRANSFERRED', details: { student_name: admission.student_name, student_email: admission.student_email, from_batch: fromBatchId, to_batch: to_batch_id, to_batch_name: destBatch.name },
        })

        res.json({ success: true, batch_name: destBatch.name })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/admissions/[id]/verify/route.ts ----
router.post('/:id/verify', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VERIFY_STUDENT')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const { id } = req.params
        const db = await getDb()

        const admission = await db.collection('ba_admissions').findOne({ _id: id as any })
        if (!admission) {
            res.status(404).json({ error: 'Student not found' })
            return
        }

        const now = new Date().toISOString()
        await db.collection('ba_admissions').updateOne(
            { _id: id as any },
            { $set: { verified_at: now, status: 'Verified', verification_status: 'verified', reviewed_by: authUserId, reviewed_at: now } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_VERIFIED', details: { student_name: admission.student_name, student_email: admission.student_email, batch_id: admission.batch_id },
        })

        if (admission.sales_id) {
            const salesUser = await db.collection('ba_users').findOne({ $or: [{ _id: admission.sales_id as any }, { sales_id: admission.sales_id }] })
            await notifyUsers({
                userIds: [salesUser?._id ? String(salesUser._id) : null],
                type: 'student_verified',
                title: 'Student verified',
                message: `${admission.student_name} has been verified by Academic Lead.`,
                link: `/dashboard/batch/${admission.batch_id}`,
            })
        }

        res.json({ success: true, verified_at: now })
    } catch (err) {
        next(err)
    }
})

export default router
