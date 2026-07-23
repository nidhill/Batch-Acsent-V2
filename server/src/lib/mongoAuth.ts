import { createClient } from '@supabase/supabase-js'
import { getDb } from './mongodb'

export interface UserProfile {
    _id: string
    email: string
    name: string | null
    role: string
    phone: string | null
    sales_id: string | null
    cliq_id: string | null
    school: string | null
    region: string | null
    requested_role: string | null
    is_approved: boolean | null
    is_active?: boolean | null
    created_at?: string
    updated_at?: string
}

export class AuthError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}

/**
 * Ported from the Next.js app's src/lib/mongoAuth.ts. Only change from the original: takes
 * the raw Authorization header value instead of a Fetch API `Request` object, since Express
 * doesn't have one — everything else (Supabase session verification, Mongo profile lookup,
 * AuthError) is unchanged.
 */
export async function requireUser(authHeader: string | undefined | null): Promise<{ authUserId: string; authEmail: string | null; profile: UserProfile }> {
    const supabaseUrl = process.env.SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY
    if (!supabaseUrl || !anonKey) {
        throw new AuthError('Server configuration error', 500)
    }

    if (!authHeader) {
        throw new AuthError('Missing Authorization header', 401)
    }
    const token = authHeader.replace('Bearer ', '')

    const supabase = createClient(supabaseUrl, anonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
        throw new AuthError('Invalid or expired session', 401)
    }

    const db = await getDb()
    // NOTE: "ba_users" (not "users") — this MongoDB database is shared with an existing,
    // separately-owned SHO/LMS app whose own "users" collection (bcrypt auth, unrelated to
    // Supabase Auth) already has 1271+ real accounts. Never point this at "users".
    const profile = await db.collection<UserProfile>('ba_users').findOne({ _id: user.id as any })
    if (!profile) {
        throw new AuthError('No profile found for this account', 401)
    }
    // Deactivating a staff account (instead of deleting it) revokes access without touching
    // their sales_id or any historical admission/payment record they're attributed to —
    // deleting the ba_users doc entirely orphans that sales_id on every past record (see the
    // "MS-01" case). `is_active` is only ever explicitly set to false; missing/undefined on
    // existing accounts means active, so this needs no backfill.
    if (profile.is_active === false) {
        throw new AuthError('Your account has been deactivated. Contact your administrator.', 403)
    }

    return { authUserId: user.id, authEmail: user.email ?? null, profile }
}

/** Throws AuthError(403) unless the profile's role is in allowedRoles. */
export function requireRole(profile: UserProfile, allowedRoles: readonly string[]): void {
    if (!allowedRoles.includes(profile.role)) {
        throw new AuthError(`Forbidden: requires one of [${allowedRoles.join(', ')}]`, 403)
    }
}
