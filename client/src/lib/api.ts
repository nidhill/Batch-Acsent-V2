import { supabase } from './supabaseClient'

// Consolidates the `authedFetch` helper that was previously duplicated in nearly every
// Next.js page/component (each one redefining the same "grab the Supabase session, prepend
// a Bearer header" closure). API_BASE is empty in dev (Vite proxy) and in the single-process
// production topology (same origin) — only needs a value if ever split into two services.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Guards against a redirect storm: when the Supabase refresh token has died (not just the
// short-lived access token — that case self-heals via getSession()'s own auto-refresh), every
// authedFetch in flight 401s at once. Every call site was independently logging "Invalid or
// expired session" to the console and leaving the page showing stale/empty data forever, with
// no way out short of the user noticing and manually reloading. This makes the dead session
// visible and recoverable — once, not once per failed request.
let handlingExpiredSession = false

async function handleExpiredSession() {
    if (handlingExpiredSession) return
    handlingExpiredSession = true
    await supabase.auth.signOut().catch(() => {})
    localStorage.removeItem('userRole')
    localStorage.removeItem('userName')
    localStorage.removeItem('userSchool')
    localStorage.removeItem('salesId')
    window.location.href = '/?sessionExpired=1'
}

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
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    if (res.status === 401) {
        handleExpiredSession()
    }
    return res
}
