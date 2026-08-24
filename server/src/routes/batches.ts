import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// ---- Ported from src/app/api/batches/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const view = (req.query.view as string) || 'current'
        const region = req.query.region as string | undefined

        const db = await getDb()
        const filter: Record<string, any> = {}

        const isSuperUser = profile.role === 'ADMIN' || profile.role === 'CEO'
        if (!isSuperUser) {
            if (profile.school) filter.school = profile.school
            if (profile.role === 'SHO' && profile.name) filter.sho_name = profile.name
        }
        if (region) filter.region = region

        if (view !== 'all') {
            const todayStr = new Date().toISOString().split('T')[0]
            filter.start_date = view === 'past' ? { $lt: todayStr } : { $gte: todayStr }
        }

        const batches = await db.collection('ba_batches').find(filter).toArray()

        // One aggregation for all batches instead of a separate countDocuments() per batch —
        // with view=all (102+ batches) that was 100+ sequential round-trips to Mongo just to
        // render the overview dashboard, the dominant cause of its slow "Loading analytics..."
        // wait.
        const batchIds = batches.map(b => b._id)
        const counts = batchIds.length > 0
            ? await db.collection('ba_admissions').aggregate([
                { $match: { batch_id: { $in: batchIds } } },
                { $group: { _id: '$batch_id', count: { $sum: 1 } } },
            ]).toArray()
            : []
        const countMap = new Map(counts.map(c => [c._id, c.count]))
        const batchesWithCounts = batches.map(batch => ({ ...batch, id: batch._id, enrolled_count: countMap.get(batch._id) || 0 }))

        res.json({ batches: batchesWithCounts })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'CREATE_EDIT_BATCH')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const { id, name, course, course_type, start_date, end_date, orientation_date, sho_name, academic_lead, strength, school, mode, cliq_id, region, course_fee } = req.body

        if (!id || !name || !course || !course_type || !start_date || !school || !region || course_fee === undefined || course_fee === '') {
            res.status(400).json({ error: 'id, name, course, course_type, start_date, school, region and course_fee are required' })
            return
        }
        if (!['main', 'short'].includes(course_type)) {
            res.status(400).json({ error: 'course_type must be "main" or "short"' })
            return
        }

        const db = await getDb()
        const cleanId = String(id).replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase()

        const existing = await db.collection('ba_batches').findOne({ _id: cleanId as any })
        if (existing) {
            res.status(409).json({ error: `Batch ID "${cleanId}" already exists` })
            return
        }

        const doc = {
            _id: cleanId as any,
            name,
            course,
            course_type,
            start_date,
            end_date: end_date || null,
            orientation_date: orientation_date || null,
            strength: parseInt(strength) || 0,
            mode: mode || 'Offline',
            school,
            region,
            course_fee: parseFloat(course_fee) || 0,
            academic_lead: academic_lead || null,
            sho_name: sho_name || null,
            cliq_id: cliq_id || null,
            is_full: false,
            created_at: new Date().toISOString(),
        }
        await db.collection('ba_batches').insertOne(doc)

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'BATCH_CREATED', details: { batch_id: cleanId, batch_name: name, school, course },
        })

        res.json({ success: true, batch: { ...doc, id: doc._id } })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batches/[id]/route.ts ----
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const id = (req.params.id as string).trim()
        const db = await getDb()

        const batch = await db.collection('ba_batches').findOne({ _id: id as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        const enrolled_count = await db.collection('ba_admissions').countDocuments({ batch_id: batch._id })
        res.json({ batch: { ...batch, id: batch._id, enrolled_count } })
    } catch (err) {
        next(err)
    }
})

router.patch('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'CREATE_EDIT_BATCH')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const cleanId = (req.params.id as string).trim()
        const updates = { ...req.body }
        delete updates._id
        delete updates.id
        delete updates.enrolled_count

        const db = await getDb()
        const original = await db.collection('ba_batches').findOne({ _id: cleanId as any })
        if (!original) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        const changes: Record<string, string> = {}
        for (const key of Object.keys(updates)) {
            if (updates[key] !== (original as any)[key]) {
                changes[key] = `${(original as any)[key]} -> ${updates[key]}`
            }
        }

        if (Object.keys(changes).length === 0) {
            res.status(400).json({ error: 'No changes detected' })
            return
        }

        await db.collection('ba_batches').updateOne({ _id: cleanId as any }, { $set: updates })

        await db.collection('ba_batch_history').insertOne({
            _id: `${cleanId}-${Date.now()}` as any,
            batch_id: cleanId,
            edited_by: profile.name || profile.email,
            edited_at: new Date().toISOString(),
            changes,
        })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'BATCH_UPDATED', details: { batch_id: cleanId, changes },
        })

        const updated = await db.collection('ba_batches').findOne({ _id: cleanId as any })
        res.json({ success: true, batch: { ...updated, id: updated?._id } })
    } catch (err) {
        next(err)
    }
})

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'DELETE_BATCH')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const cleanId = (req.params.id as string).trim()

        const db = await getDb()
        const batch = await db.collection('ba_batches').findOne({ _id: cleanId as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        await db.collection('ba_admissions').deleteMany({ batch_id: cleanId })
        await db.collection('ba_students').deleteMany({ batch_id: cleanId })
        await db.collection('ba_student_batches').deleteMany({ batch_id: cleanId })
        await db.collection('ba_batch_history').deleteMany({ batch_id: cleanId })
        await db.collection('ba_batches').deleteOne({ _id: cleanId as any })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'BATCH_DELETED', details: { batch_id: cleanId, batch_name: batch.name },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batches/[id]/history/route.ts ----
router.get('/:id/history', authenticate, async (req, res, next) => {
    try {
        const id = (req.params.id as string).trim()
        const db = await getDb()
        const history = await db.collection('ba_batch_history')
            .find({ batch_id: id })
            .sort({ edited_at: -1 })
            .toArray()
        res.json({ history: history.map(h => ({ ...h, id: h._id })) })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batches/[id]/refresh-cliq-id/route.ts ----
router.post('/:id/refresh-cliq-id', authenticate, async (req, res, next) => {
    try {
        const batchId = (req.params.id as string).trim()
        const db = await getDb()

        const batch = await db.collection('ba_batches').findOne({ _id: batchId as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }
        if (!batch.sho_name) {
            res.status(400).json({ error: 'Batch has no assigned SHO' })
            return
        }

        const sho = await db.collection('ba_users').findOne({ name: batch.sho_name, role: 'SHO' })
        if (!sho?.cliq_id) {
            res.status(404).json({ error: `No Cliq ID found for SHO: ${batch.sho_name}` })
            return
        }

        await db.collection('ba_batches').updateOne({ _id: batchId as any }, { $set: { cliq_id: sho.cliq_id } })
        res.json({ success: true, cliq_id: sho.cliq_id })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batches/[id]/students/route.ts ----
router.get('/:id/students', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const batchId = (req.params.id as string).trim()
        const db = await getDb()

        const enrollments = await db.collection('ba_admissions')
            .find({ batch_id: batchId })
            .sort({ linked_at: -1 })
            .toArray()

        const salesIds = Array.from(new Set(enrollments.map(e => e.sales_id).filter(Boolean)))
        const salesMap = new Map<string, any>()
        if (salesIds.length > 0) {
            const salesUsers = await db.collection('ba_users').find({
                $or: [{ _id: { $in: salesIds as any[] } }, { sales_id: { $in: salesIds } }]
            }).project({ name: 1, phone: 1, sales_id: 1 }).toArray()
            salesUsers.forEach(u => {
                if (u.sales_id) salesMap.set(u.sales_id, u)
                salesMap.set(String(u._id), u)
            })
        }

        const officialStudents = await db.collection('ba_students')
            .find({ batch_id: batchId })
            .project({ email: 1, student_id: 1 })
            .toArray()
        const officialMap = new Map(officialStudents.map(s => [s.email, s.student_id]))

        const admissionIds = enrollments.map(e => e._id)
        const canSeePayments = can(profile.role, 'VIEW_PAYMENT_DETAILS')
        const payments = admissionIds.length > 0
            ? await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            : []
        const paymentMap = new Map(payments.map(p => [p.admission_id, p]))

        const students = enrollments.map(e => {
            const payment = paymentMap.get(e._id)
            const payment_clearance_status = payment
                ? (payment.remaining_amount <= 0 ? 'Cleared' : 'Pending')
                : 'Restricted'
            return {
                ...e,
                id: e._id,
                sales_person: e.sales_id ? salesMap.get(e.sales_id) : null,
                onboarding_completed: officialMap.has(e.student_email) || e.onboarding_completed,
                official_student_id: officialMap.get(e.student_email),
                payment_clearance_status,
                payment: canSeePayments ? payment : undefined,
            }
        })

        res.json({ students })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/batches/[id]/transfer-sho/route.ts ----
router.post('/:id/transfer-sho', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'CREATE_EDIT_BATCH')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const batchId = (req.params.id as string).trim()
        const { sho_user_id } = req.body || {}
        if (!sho_user_id) {
            res.status(400).json({ error: 'sho_user_id is required' })
            return
        }

        const db = await getDb()
        const batch = await db.collection('ba_batches').findOne({ _id: batchId as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        const sho = await db.collection('ba_users').findOne({ _id: sho_user_id as any })
        if (!sho) {
            res.status(404).json({ error: 'SHO not found' })
            return
        }

        const oldSho = batch.sho_name
        await db.collection('ba_batches').updateOne({ _id: batchId as any }, { $set: { sho_name: sho.name } })
        await db.collection('ba_batch_history').insertOne({
            _id: `${batchId}-${Date.now()}` as any,
            batch_id: batchId,
            edited_by: profile.name || profile.email,
            edited_at: new Date().toISOString(),
            changes: { sho_name: `${oldSho} -> ${sho.name}` },
        })

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'SHO_TRANSFERRED', details: { batch_id: batchId, from_sho: oldSho, to_sho: sho.name },
        })

        res.json({ success: true, sho_name: sho.name })
    } catch (err) {
        next(err)
    }
})

export default router
