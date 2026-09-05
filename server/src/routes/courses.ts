import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// ---- Ported from src/app/api/courses/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const db = await getDb()
        const courses = await db.collection('ba_courses').find({}).sort({ name: 1 }).toArray()
        res.json({ courses })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const { name, code, school_name, regions } = req.body
        if (!name || !code) {
            res.status(400).json({ error: 'name and code are required' })
            return
        }

        const db = await getDb()
        const doc = {
            _id: randomUUID() as any,
            name,
            code: code.toUpperCase(),
            school_name: school_name || null,
            is_active: true,
            regions: Array.isArray(regions) ? regions : [],
            created_at: new Date().toISOString(),
        }
        await db.collection('ba_courses').insertOne(doc)

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'COURSE_CREATED', details: { course_id: doc._id, name, code },
        })

        res.json({ success: true, course: doc })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/courses/[id]/route.ts ----
router.patch('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        const { name, code, school_name, is_active, regions } = req.body

        const update: Record<string, any> = {}
        if (name !== undefined) update.name = name
        if (code !== undefined) update.code = code.toUpperCase()
        if (school_name !== undefined) update.school_name = school_name
        if (is_active !== undefined) update.is_active = is_active
        if (regions !== undefined) update.regions = Array.isArray(regions) ? regions : []

        const db = await getDb()
        const result = await db.collection('ba_courses').findOneAndUpdate(
            { _id: id as any },
            { $set: update },
            { returnDocument: 'after' }
        )
        if (!result) {
            res.status(404).json({ error: 'Course not found' })
            return
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'COURSE_UPDATED', details: { course_id: id, ...update },
        })

        res.json({ success: true, course: result })
    } catch (err) {
        next(err)
    }
})

router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string

        const db = await getDb()
        const course = await db.collection('ba_courses').findOne({ _id: id as any })
        const result = await db.collection('ba_courses').deleteOne({ _id: id as any })
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Course not found' })
            return
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'COURSE_DELETED', details: { course_id: id, name: course?.name },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
