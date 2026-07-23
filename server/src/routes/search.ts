import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'

const router = Router()

// SRS Doc 6 §11 "Global Search" — student name/ID/mobile/email, batch, course, all from one
// box. Reuses the same school-scoping every other route applies.
// ---- Ported from src/app/api/search/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const q = ((req.query.q as string) || '').trim()
        if (q.length < 2) {
            res.json({ students: [], batches: [] })
            return
        }

        const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        const db = await getDb()
        const isSuperUser = ['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(profile.role)

        // ---- Scoped batch set (same rule as /api/batches) ----
        const batchFilter: Record<string, any> = {}
        if (!isSuperUser && profile.school) batchFilter.school = profile.school
        const scopedBatches = await db.collection('ba_batches').find(batchFilter).project({ name: 1, course: 1, school: 1 }).toArray()
        const scopedBatchIds = scopedBatches.map(b => String(b._id))

        const matchingBatches = scopedBatches
            .filter(b => rx.test(b.name) || rx.test(String(b._id)) || rx.test(b.course || ''))
            .slice(0, 10)
            .map(b => ({ id: b._id, name: b.name, course: b.course, school: b.school }))

        // ---- Students (admissions) within the scoped batches ----
        const admissionFilter: Record<string, any> = {
            batch_id: { $in: scopedBatchIds },
            $or: [{ student_name: rx }, { student_email: rx }, { student_phone: rx }, { official_student_id: rx }],
        }
        if (profile.role === 'SALES' && profile.sales_id) admissionFilter.sales_id = profile.sales_id

        const matchingAdmissions = await db.collection('ba_admissions').find(admissionFilter).limit(10).toArray()
        const batchNameMap = new Map(scopedBatches.map(b => [String(b._id), b.name]))
        const students = matchingAdmissions.map(a => ({
            id: a._id,
            student_name: a.student_name,
            student_email: a.student_email,
            official_student_id: a.official_student_id || null,
            batch_id: a.batch_id,
            batch_name: batchNameMap.get(a.batch_id) || a.batch_id,
        }))

        res.json({ students, batches: matchingBatches })
    } catch (err) {
        next(err)
    }
})

export default router
