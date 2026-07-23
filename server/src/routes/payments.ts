import { Router } from 'express'
import { randomUUID } from 'crypto'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { logMongoActivity } from '../lib/mongoActivity'

const router = Router()

// { id } is the payment_id (ba_payments._id)
// ---- Ported from src/app/api/payments/[id]/transactions/route.ts ----
router.get('/:id/transactions', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!can(profile.role, 'VIEW_PAYMENT_DETAILS')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        const db = await getDb()
        const transactions = await db.collection('ba_payment_transactions')
            .find({ payment_id: id })
            .sort({ paid_at: -1 })
            .toArray()
        res.json({ transactions: transactions.map(t => ({ ...t, id: t._id })) })
    } catch (err) {
        next(err)
    }
})

// Records a new installment/payment against an existing payment record and updates the
// running amount_paid/remaining_amount/payment_status on ba_payments.
router.post('/:id/transactions', authenticate, async (req, res, next) => {
    try {
        const { authUserId, profile } = req.auth!
        if (!can(profile.role, 'VIEW_PAYMENT_DETAILS')) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }
        const id = req.params.id as string
        const { amount, method, channel, transaction_number, receipt_number, remarks, next_due_date } = req.body
        if (!amount || amount <= 0) {
            res.status(400).json({ error: 'A positive amount is required' })
            return
        }

        const db = await getDb()
        const payment = await db.collection('ba_payments').findOne({ _id: id as any })
        if (!payment) {
            res.status(404).json({ error: 'Payment record not found' })
            return
        }

        const priorCount = await db.collection('ba_payment_transactions').countDocuments({ payment_id: id })
        const now = new Date().toISOString()

        await db.collection('ba_payment_transactions').insertOne({
            _id: randomUUID() as any,
            payment_id: id,
            admission_id: payment.admission_id,
            amount: parseFloat(amount),
            method: method || null,
            channel: channel || null,
            transaction_number: transaction_number || null,
            receipt_number: receipt_number || null,
            remarks: remarks || null,
            next_due_date: next_due_date || null,
            installment_number: priorCount + 1,
            recorded_by: authUserId,
            paid_at: now,
        })

        const newAmountPaid = (payment.amount_paid || 0) + parseFloat(amount)
        const newRemaining = Math.max(0, payment.final_fee - newAmountPaid)
        const newStatus = newRemaining <= 0 ? 'full' : payment.payment_status

        await db.collection('ba_payments').updateOne(
            { _id: id as any },
            { $set: { amount_paid: newAmountPaid, remaining_amount: newRemaining, payment_status: newStatus, updated_at: now } }
        )

        await logMongoActivity({
            request: req, userId: authUserId, userName: profile.name, userEmail: profile.email, userRole: profile.role,
            action: 'PAYMENT_RECORDED', details: { admission_id: payment.admission_id, amount, remaining: newRemaining },
        })

        res.json({ success: true, amount_paid: newAmountPaid, remaining_amount: newRemaining })
    } catch (err) {
        next(err)
    }
})

export default router
