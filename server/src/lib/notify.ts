import { randomUUID } from 'crypto'
import { getDb } from './mongodb'
import { sendEmail, notificationEmailHtml } from './email'

/**
 * Ported unchanged from src/lib/notify.ts. Creates in-app notifications for one or more
 * recipients (SRS Doc 6 §4), and also emails them via Resend when RESEND_API_KEY/
 * RESEND_FROM_EMAIL are configured (see ./email.ts — a safe no-op otherwise).
 */
export async function notifyUsers(params: {
    userIds: (string | null | undefined)[]
    type: string
    title: string
    message: string
    link?: string
}) {
    const recipients = Array.from(new Set(params.userIds.filter(Boolean))) as string[]
    if (recipients.length === 0) return

    try {
        const db = await getDb()
        const now = new Date().toISOString()
        await db.collection('ba_notifications').insertMany(
            recipients.map(userId => ({
                _id: randomUUID() as any,
                user_id: userId,
                type: params.type,
                title: params.title,
                message: params.message,
                link: params.link || null,
                is_read: false,
                created_at: now,
            }))
        )

        const users = await db.collection('ba_users').find({ _id: { $in: recipients as any[] } }).project({ email: 1 }).toArray()
        const html = notificationEmailHtml(params.title, params.message, params.link)
        await Promise.all(
            users.filter(u => u.email).map(u => sendEmail({ to: u.email, subject: params.title, html }))
        )
    } catch (err) {
        console.error('notifyUsers failed (non-fatal):', err)
    }
}

/** Looks up every ba_users doc matching one of the given roles (optionally scoped to a school), for role-targeted notifications like "notify Sales Head". */
export async function findUserIdsByRole(roles: string[], school?: string | null): Promise<string[]> {
    try {
        const db = await getDb()
        const filter: Record<string, any> = { role: { $in: roles } }
        if (school) filter.school = school
        const users = await db.collection('ba_users').find(filter).project({ _id: 1 }).toArray()
        return users.map(u => String(u._id))
    } catch (err) {
        console.error('findUserIdsByRole failed:', err)
        return []
    }
}
