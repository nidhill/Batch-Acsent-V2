import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { notifyUsers } from '../lib/notify'
import { syncFromSupabase } from '../lib/supabaseSync'

const router = Router()

// SRS Doc 3 §6 / Doc 6 §5 "Payment Reminder System" — T-1 / due-date / overdue reminders for
// Advance/Partial/EMI payments, notifying the Sales Executive and Sales Head. This app has no
// built-in scheduler, so this is a plain HTTP endpoint meant to be hit by an external cron once
// a day — not by a logged-in user. Protected by CRON_SECRET; without one set, it refuses to run.
// ---- Ported from src/app/api/cron/payment-reminders/route.ts ----
router.get('/payment-reminders', async (req, res, next) => {
    try {
        const secret = process.env.CRON_SECRET
        if (!secret) {
            res.status(500).json({ error: 'CRON_SECRET is not configured — refusing to run an unauthenticated reminder job' })
            return
        }
        const authHeader = req.headers.authorization
        const provided = authHeader?.replace('Bearer ', '') || (req.query.secret as string | undefined)
        if (provided !== secret) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const db = await getDb()
        const todayStr = new Date().toISOString().split('T')[0]
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const tomorrowStr = tomorrow.toISOString().split('T')[0]

        const pendingPayments = await db.collection('ba_payments').find({ remaining_amount: { $gt: 0 } }).toArray()
        const admissionIds = pendingPayments.map(p => p.admission_id)
        if (admissionIds.length === 0) {
            res.json({ processed: 0, reminders_sent: 0 })
            return
        }

        const latestTxns = await db.collection('ba_payment_transactions')
            .find({ admission_id: { $in: admissionIds }, next_due_date: { $ne: null } })
            .sort({ paid_at: -1 })
            .toArray()
        const latestDueByAdmission = new Map<string, string>()
        latestTxns.forEach(t => {
            if (!latestDueByAdmission.has(t.admission_id)) latestDueByAdmission.set(t.admission_id, t.next_due_date)
        })

        const admissions = await db.collection('ba_admissions').find({ _id: { $in: admissionIds } }).toArray()
        const admissionMap = new Map(admissions.map(a => [String(a._id), a]))

        let remindersSent = 0
        for (const [admissionId, dueDate] of latestDueByAdmission.entries()) {
            const admission = admissionMap.get(admissionId)
            if (!admission) continue

            let reminderType: 'T-1' | 'due' | 'overdue' | null = null
            if (dueDate === tomorrowStr) reminderType = 'T-1'
            else if (dueDate === todayStr) reminderType = 'due'
            else if (dueDate < todayStr) reminderType = 'overdue'
            if (!reminderType) continue

            // At most one reminder per admission per day, tracked on the admission itself.
            const payment = pendingPayments.find(p => p.admission_id === admissionId)
            if (payment?.last_reminder_sent_on === todayStr && payment?.last_reminder_type === reminderType) continue

            const salesUsers = admission.sales_id
                ? await db.collection('ba_users').find({ sales_id: admission.sales_id }).project({ _id: 1 }).toArray()
                : []
            const salesHeadUsers = await db.collection('ba_users').find({ role: 'SALES_HEAD' }).project({ _id: 1 }).toArray()

            const labels = { 'T-1': 'is due tomorrow', due: 'is due today', overdue: 'is overdue' }
            await notifyUsers({
                userIds: [...salesUsers.map(u => String(u._id)), ...salesHeadUsers.map(u => String(u._id))],
                type: `payment_${reminderType === 'T-1' ? 'due_soon' : reminderType}`,
                title: reminderType === 'overdue' ? 'Payment overdue' : 'Payment reminder',
                message: `${admission.student_name}'s payment ${labels[reminderType]} (due ${dueDate}).`,
                link: `/dashboard/student/${admissionId}`,
            })

            await db.collection('ba_payments').updateOne(
                { _id: payment?._id },
                { $set: { last_reminder_sent_on: todayStr, last_reminder_type: reminderType } }
            )
            remindersSent++
        }

        res.json({ processed: latestDueByAdmission.size, reminders_sent: remindersSent })
    } catch (err) {
        next(err)
    }
})

// Keeps MongoDB caught up with the old Next.js app's still-live Supabase writes — see
// lib/supabaseSync.ts for why this is insert-only, never overwriting existing documents.
// Same CRON_SECRET pattern as payment-reminders above; meant to be hit by an external
// scheduler (e.g. every 15 minutes), not by a logged-in user.
router.get('/sync-supabase', async (req, res, next) => {
    try {
        const secret = process.env.CRON_SECRET
        if (!secret) {
            res.status(500).json({ error: 'CRON_SECRET is not configured — refusing to run an unauthenticated sync job' })
            return
        }
        const authHeader = req.headers.authorization
        const provided = authHeader?.replace('Bearer ', '') || (req.query.secret as string | undefined)
        if (provided !== secret) {
            res.status(401).json({ error: 'Unauthorized' })
            return
        }

        const results = await syncFromSupabase()
        const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
        res.json({ synced_at: new Date().toISOString(), total_inserted: totalInserted, results })
    } catch (err) {
        next(err)
    }
})

export default router
