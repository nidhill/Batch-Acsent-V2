import { createClient } from '@supabase/supabase-js'

// Ported from src/lib/supabaseClient.ts. Only change: reads Vite's import.meta.env instead
// of Next.js's process.env, with the VITE_ prefix instead of NEXT_PUBLIC_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        flowType: 'pkce',
    }
})
