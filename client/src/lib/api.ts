import { supabase } from './supabaseClient'

// Consolidates the `authedFetch` helper that was previously duplicated in nearly every
// Next.js page/component (each one redefining the same "grab the Supabase session, prepend
// a Bearer header" closure). API_BASE is empty in dev (Vite proxy) and in the single-process
// production topology (same origin) — only needs a value if ever split into two services.
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function authedFetch(path: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `Bearer ${session?.access_token}`,
    }
    // Don't force Content-Type on FormData bodies (file uploads) — the browser needs to set
    // its own multipart boundary.
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json'
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers })
}
