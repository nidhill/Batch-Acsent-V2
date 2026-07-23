import { randomUUID } from 'crypto'
import type { Request } from 'express'
import { getDb } from './mongodb'

// SRS Doc 2 Admin "enriched activity logs" — group every action under a human-readable
// module instead of leaving the raw ACTION_STRING as the only categorization, inferred from
// the action's prefix so existing call sites don't all need to be touched individually.
const MODULE_PREFIXES: [string, string][] = [
    ['LOGIN', 'Auth'],
    ['ROLE_CHANGE', 'User Management'],
    ['USER_', 'User Management'],
    ['STUDENT_DOCUMENT', 'Documents'],
    ['STUDENT_', 'Student'],
    ['SHO_TRANSFERRED', 'Batch Transfer'],
    ['BATCH_TRANSFER', 'Batch Transfer'],
    ['BATCH_', 'Batch'],
    ['LEARNER_AGREEMENT', 'Learner Agreement'],
    ['LMS_ACCESS_POLICY', 'Settings'],
    ['PAYMENT', 'Payment'],
    ['SCHOOL_', 'Schools & Courses'],
    ['COURSE_', 'Schools & Courses'],
]

function inferModule(action: string): string {
    const match = MODULE_PREFIXES.find(([prefix]) => action.startsWith(prefix))
    return match ? match[1] : 'General'
}

// Ported from src/lib/mongoActivity.ts. Only change: reads headers off an Express `Request`
// (`req.get(...)`) instead of the Fetch API `Request` (`request.headers.get(...)`).
export async function logMongoActivity(params: {
    request: Request
    userId: string
    userName: string | null
    userEmail: string | null
    userRole: string | null
    action: string
    details?: Record<string, any>
    module?: string
}) {
    try {
        const db = await getDb()
        const ip = params.request.get('x-forwarded-for')?.split(',')[0]?.trim()
            || params.request.get('x-real-ip') || params.request.ip || 'Unknown'
        const userAgent = params.request.get('user-agent') || 'Unknown'

        await db.collection('ba_activity_logs').insertOne({
            _id: randomUUID() as any,
            user_id: params.userId,
            user_name: params.userName,
            user_email: params.userEmail,
            user_role: params.userRole,
            action: params.action,
            module: params.module || inferModule(params.action),
            details: params.details || {},
            ip_address: ip,
            user_agent: userAgent,
            created_at: new Date().toISOString(),
        })
    } catch (err) {
        console.error('logMongoActivity failed (non-fatal):', err)
    }
}
