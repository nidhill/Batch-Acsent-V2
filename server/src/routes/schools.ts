import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// ---- Ported from src/app/api/schools/route.ts ----
// "schools" is the LMS/SHO app's shared collection (not a ba_* collection). Deliberately
// unauthenticated GET: school names/codes aren't sensitive, and the signup page (pre-login)
// needs this list too.
router.get('/', async (req, res, next) => {
    try {
        const db = await getDb()
        const schools = await db.collection('schools').find({}).sort({ name: 1 }).toArray()
        res.json({ schools })
    } catch (err) {
        next(err)
    }
})

router.post('/', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_SCHOOLS_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const { name, code } = req.body
        if (!name || !code) {
            res.status(400).json({ error: 'name and code are required' })
            return
        }

        const db = await getDb()
        const existing = await db.collection('schools').findOne({ name: { $regex: `^${name}$`, $options: 'i' } })
        if (existing) {
            res.status(409).json({ error: 'A school with this name already exists' })
            return
        }

        const now = new Date().toISOString()
        const doc = {
            name,
            code: code.toUpperCase(),
            address: name,
            place: 'Unknown',
            totalBatches: 0,
            totalStudents: 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        }
        const result = await db.collection('schools').insertOne(doc as any)

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'SCHOOL_CREATED', details: { school_id: result.insertedId.toString(), name, code },
        })

        res.json({ success: true, school: { _id: result.insertedId, ...doc } })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/schools/[id]/route.ts ----
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'MANAGE_SCHOOLS_COURSES')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        if (!ObjectId.isValid(id)) {
            res.status(400).json({ error: 'Invalid school id' })
            return
        }

        const db = await getDb()
        const school = await db.collection('schools').findOne({ _id: new ObjectId(id) })
        const result = await db.collection('schools').deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'School not found' })
            return
        }

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'SCHOOL_DELETED', details: { school_id: id, name: school?.name },
        })

        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
