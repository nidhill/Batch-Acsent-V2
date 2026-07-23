import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Ported from src/lib/supabaseAdmin.ts. Only change: reads `SUPABASE_URL` (server env,
// unprefixed) instead of `NEXT_PUBLIC_SUPABASE_URL` — the URL itself isn't secret, but the
// NEXT_PUBLIC_ prefix was a Next.js client-bundling convention that doesn't apply here.
let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
    if (adminClient) return adminClient
    const supabaseUrl = process.env.SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Server configuration error: missing Supabase service role env vars')
    }
    adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    return adminClient
}

export const ADMISSION_DOCUMENTS_BUCKET = 'admission-documents'

let bucketEnsured = false
export async function ensureDocumentsBucket() {
    if (bucketEnsured) return
    const admin = getSupabaseAdmin()
    const { data: buckets } = await admin.storage.listBuckets()
    if (!buckets?.some(b => b.name === ADMISSION_DOCUMENTS_BUCKET)) {
        await admin.storage.createBucket(ADMISSION_DOCUMENTS_BUCKET, { public: false })
    }
    bucketEnsured = true
}
