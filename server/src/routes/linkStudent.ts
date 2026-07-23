import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate, requireRole } from '../middleware/auth'
import { logMongoActivity } from '../lib/mongoActivity'
import { notifyUsers, findUserIdsByRole } from '../lib/notify'

const router = Router()

const COURSE_CODES: Record<string, string> = {
    'Applied AI': 'AA',
    'N8N': 'NN',
    'Data Analytics': 'DA',
    'Python': 'PY',
    'Branding': 'BR',
    'UI/UX': 'UX',
    'Graphic Design': 'GD',
    'Video Editing': 'VE',
    'Social Media Mastery': 'SM',
    'Performance Marketing': 'PM',
    'Digital Marketing': 'DM',
    'Advanced Practical Accounting and Financial Intelligence': 'AF',
    'Advanced Taxation Course': 'TX',
    'HACA Scale Up': 'SU',
    'Tax Practitioner Bootcamp': 'TB',
    'Flutter full stack': 'FL',
    'NAME': 'GEN',
}

// ---- Ported from src/app/api/link-student/route.ts ----
router.post('/', authenticate, requireRole('ADMIN', 'CEO', 'SHO', 'SSHO', 'ACADEMIC_LEAD', 'SALES_HEAD'), async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        const isAdmin = ['ADMIN', 'CEO'].includes(profile.role)

        const { student_name, student_email, student_phone, batch_id, sales_user_id } = req.body
        if (!student_name || !student_email || !student_phone || !batch_id || !sales_user_id) {
            res.status(400).json({ error: 'Missing required fields' })
            return
        }

        const db = await getDb()

        const salesPerson = await db.collection('ba_users').findOne({ _id: sales_user_id as any })
        if (!salesPerson) {
            res.status(400).json({ error: 'Selected Sales Executive not found in database' })
            return
        }

        const batch = await db.collection('ba_batches').findOne({ _id: batch_id as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        // Region Matching (SRS Doc 4 §11) — a staff member assigned to one operating region
        // shouldn't silently link students into a batch running in a different region;
        // Admin/CEO/Business Head operate across all regions.
        if (!['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(profile.role) && profile.region && batch.region && profile.region !== batch.region) {
            res.status(400).json({ error: `Region mismatch: you are assigned to "${profile.region}" but this batch belongs to "${batch.region}".` })
            return
        }

        const enrolledCount = await db.collection('ba_admissions').countDocuments({ batch_id })

        if (!isAdmin && batch.strength && enrolledCount >= batch.strength) {
            const payload = {
                sales_id: salesPerson.sales_id, sales_email: salesPerson.email,
                student_name, student_email, student_phone,
                batch_name: batch.name, batch_id, school: batch.school, course: batch.course,
                status: 'BATCH_FULL_OVERFLOW',
            }
            try {
                await fetch('https://purpletech.app.n8n.cloud/webhook/fafed605-b9af-4f2c-92b5-082b14770997', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
                })
            } catch (err) { console.error('Overflow webhook error:', err) }

            res.status(409).json({
                success: false,
                error: `Batch is full (${enrolledCount}/${batch.strength} students). Student has been added to the waitlist.`,
                code: 'BATCH_FULL',
            })
            return
        }

        const existingByEmail = await db.collection('ba_admissions').findOne({ student_email })
        if (existingByEmail) {
            res.status(400).json({ error: `A student with email "${student_email}" is already enrolled. Duplicate emails are not allowed.` })
            return
        }

        const last10 = student_phone.replace(/\D/g, '').slice(-10)
        const allPhones = await db.collection('ba_admissions').find({}).project({ student_name: 1, student_email: 1, student_phone: 1 }).toArray()
        const dupPhone = allPhones.find(r => r.student_phone && String(r.student_phone).replace(/\D/g, '').slice(-10) === last10)
        if (dupPhone) {
            res.status(400).json({ error: `A student with this phone number is already enrolled (${dupPhone.student_name} — ${dupPhone.student_email}). Duplicate phone numbers are not allowed.` })
            return
        }

        // School code — read-only lookup against the LMS's shared "schools" collection (never written to)
        const schoolDoc = await db.collection('schools').findOne({ name: batch.school })
        const schoolCode = schoolDoc?.code || 'XX'
        const courseCode = COURSE_CODES[batch.course] || 'YY'

        // Atomic sequence counter — Batch Ascent's own concept, kept out of the shared schools collection
        const counter = await db.collection('ba_school_counters').findOneAndUpdate(
            { _id: schoolCode as any },
            { $inc: { count: 1 } },
            { upsert: true, returnDocument: 'after' }
        )
        const seq = counter?.count || 1
        const newStudentId = `${schoolCode}${courseCode}${String(seq).padStart(4, '0')}`

        // SRS Doc 4 §7/§8: verification scope covers new admissions, post-start additions, and
        // (separately) transfer requests. Students added by SHO/SSHO need Academic Lead
        // sign-off same as any other new admission.
        const todayStr = new Date().toISOString().split('T')[0]
        const actionType = batch.start_date && batch.start_date <= todayStr ? 'post_start_addition' : 'new_admission'

        const now = new Date().toISOString()
        await db.collection('ba_admissions').insertOne({
            _id: randomUUID() as any,
            student_name, student_email, student_phone, batch_id,
            sales_id: salesPerson.sales_id || salesPerson._id,
            region: batch.region || null,
            status: 'Pending', onboarding_completed: false,
            action_type: actionType,
            added_by_role: profile.role,
            verification_status: 'pending',
            linked_at: now, enrolled_at: now,
        })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'STUDENT_ADDED', details: { student_name, student_email, batch_id, student_phone },
        })

        const academicLeadIds = await findUserIdsByRole(['ACADEMIC_LEAD'], batch.school)
        await notifyUsers({
            userIds: academicLeadIds,
            type: 'student_admitted',
            title: 'New student pending verification',
            message: `${student_name} was added to ${batch.name} and needs verification.`,
            link: `/dashboard/verification-queue`,
        })

        const newCount = enrolledCount + 1
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

        res.json({ success: true, generated_id: newStudentId })
    } catch (err) {
        next(err)
    }
})

export default router
