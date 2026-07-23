import { supabase } from './supabaseClient'

// Ported from src/lib/logActivity.ts. Dropped the `typeof window !== 'undefined'` guards —
// those were SSR-safety checks for Next.js; this is now a plain Vite SPA where this module
// only ever runs in the browser, so they're always-true dead code. Otherwise unchanged,
// including the pre-existing behavior of not attaching an Authorization header here (same
// as the original — not something to silently "fix" during a straight port).
export async function logActivity(params: {
    action: string
    details?: Record<string, any>
}) {
    try {
        const user_name = localStorage.getItem('userName') || ''
        const user_role = localStorage.getItem('userRole') || ''

        const { data: { session } } = await supabase.auth.getSession()
        const user_id = session?.user?.id || null
        const user_email = session?.user?.email || ''

        await fetch('/api/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id,
                user_name,
                user_email,
                user_role,
                action: params.action,
                details: params.details || {}
            })
        })
    } catch {
        // fire and forget — never block the main flow
    }
}
