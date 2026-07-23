import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'

const router = Router()
const VALID_STATUSES = ['new', 'contacted', 'converted', 'lost']

// ---- Ported from src/app/api/leads/route.ts ----
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const status = req.query.status as string | undefined

        const db = await getDb()
        const filter: Record<string, any> = {}
        if (status) filter.status = status
        if (profile.role === 'SALES') filter.sales_id = profile.sales_id
        else if (!can(profile.role, 'VIEW_ALL_SCHOOLS') && profile.school) filter.school = profile.school

        const leads = await db.collection('ba_leads').find(filter).sort({ created_at: -1 }).toArray()
        res.json({ leads: leads.map(l => ({ ...l, id: l._id })) })
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

        const { name, phone, email, lead_source, region, school, interested_course, notes } = req.body
        if (!name || !phone) {
            res.status(400).json({ error: 'name and phone are required' })
            return
        }

        const now = new Date().toISOString()
        const doc = {
            _id: randomUUID() as any,
            name,
            phone,
            email: email || null,
            lead_source: lead_source || null,
            region: region || null,
            school: school || profile.school || null,
            interested_course: interested_course || null,
            notes: notes || null,
            status: 'new',
            sales_id: profile.sales_id || null,
            created_by: profile._id,
            created_at: now,
            updated_at: now,
            converted_admission_id: null,
            converted_at: null,
        }
        const db = await getDb()
        await db.collection('ba_leads').insertOne(doc)

        res.json({ success: true, lead: { ...doc, id: doc._id } })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/leads/[id]/route.ts ----
router.patch('/:id', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const id = req.params.id as string
        const db = await getDb()

        const lead = await db.collection('ba_leads').findOne({ _id: id as any })
        if (!lead) {
            res.status(404).json({ error: 'Lead not found' })
            return
        }
        if (profile.role === 'SALES' && lead.sales_id !== profile.sales_id) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const { status, notes } = req.body
        const update: Record<string, any> = { updated_at: new Date().toISOString() }
        if (status !== undefined) {
            if (!VALID_STATUSES.includes(status)) {
                res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` })
                return
            }
            update.status = status
        }
        if (notes !== undefined) update.notes = notes

        await db.collection('ba_leads').updateOne({ _id: id as any }, { $set: update })
        res.json({ success: true })
    } catch (err) {
        next(err)
    }
})

export default router
