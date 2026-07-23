import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'

const router = Router()

// ---- Ported from src/app/api/webhooks/n8n/enroll/route.ts ----
router.post('/n8n/enroll', async (req, res, next) => {
    try {
        const { name, email, phone, batch_id } = req.body

        if (!email || !batch_id) {
            res.status(400).json({ error: 'Email and Batch ID are required' })
            return
        }

        const db = await getDb()

        const batch = await db.collection('ba_batches').findOne({ _id: batch_id as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        const count = await db.collection('ba_student_batches').countDocuments({ batch_id })
        if (batch.strength && count >= batch.strength) {
            res.status(400).json({ error: 'Batch is full' })
            return
        }

        const doc = {
            _id: randomUUID() as any,
            student_name: name,
            student_email: email,
            student_phone: phone,
            batch_id,
            linked_at: new Date().toISOString(),
            status: 'Pending',
            onboarding_completed: false,
        }
        await db.collection('ba_student_batches').insertOne(doc)

        res.json({ success: true, data: { ...doc, id: doc._id } })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/api/webhooks/sales-enroll/route.ts ----
router.post('/sales-enroll', async (req, res, next) => {
    try {
        const { student_name, student_email, student_phone, batch_id, sales_id } = req.body

        if (!student_email || !batch_id || !sales_id) {
            res.status(400).json({ error: 'Student email, Batch ID, and Sales ID are required' })
            return
        }

        const db = await getDb()

        const salesPerson = await db.collection('ba_users').findOne({ sales_id, role: 'SALES' })
        if (!salesPerson) {
            res.status(400).json({ error: 'Invalid Sales ID' })
            return
        }

        const batch = await db.collection('ba_batches').findOne({ _id: batch_id as any })
        if (!batch) {
            res.status(404).json({ error: 'Batch not found' })
            return
        }

        const count = await db.collection('ba_student_batches').countDocuments({ batch_id })
        if (batch.strength && count >= batch.strength) {
            res.status(400).json({ error: 'Batch is full' })
            return
        }

        const now = new Date().toISOString()

        await db.collection('ba_student_batches').insertOne({
            _id: randomUUID() as any,
            student_email, student_name, student_phone, batch_id,
            linked_at: now, status: 'Pending', onboarding_completed: false,
        })

        try {
            await db.collection('ba_admissions').insertOne({
                _id: randomUUID() as any,
                student_email, student_name, student_phone, batch_id, sales_id,
                enrolled_at: now, linked_at: now, status: 'Pending', onboarding_completed: false,
            })
        } catch (err) {
            console.error('Failed to record admission (non-fatal):', err)
        }

        res.json({ success: true, message: 'Student enrolled successfully', sales_person: salesPerson.name })
    } catch (err) {
        next(err)
    }
})

// ---- Ported from src/app/actions/sales.ts's `triggerVerificationWebhook` Server Action.
// It was a pure fetch() wrapper with zero Next request-context dependency, called from 3
// client components — becomes a plain POST endpoint the client calls instead of an RPC.
const TRIGGER_WEBHOOK_IDS: Record<string, string> = {
    verification: 'bcc93a8e-ce14-41e8-ad43-265a66a7ddd7',
    update_email: '956a4dff-4798-47ec-9da1-9d761fc3b156',
}
router.post('/trigger-verification', async (req, res) => {
    const { payload, type } = req.body as { payload: any; type?: 'verification' | 'update_email' }
    const webhookId = TRIGGER_WEBHOOK_IDS[type || 'verification']
    const webhookUrl = `https://purpletech.app.n8n.cloud/webhook/${webhookId}`

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Webhook failed: ${response.status} ${text}`)
        }
        const data = await response.json()
        res.json({ success: true, data })
    } catch (err: any) {
        console.error('trigger-verification webhook error:', err)
        res.json({ success: false, error: err.message })
    }
})

export default router
