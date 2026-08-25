import 'dotenv/config'
import { createApp } from './app'
import { syncFromSupabase } from './lib/supabaseSync'

const PORT = process.env.PORT || 4000

const app = createApp()

app.listen(PORT, () => {
    console.log(`Batch Ascent API listening on http://localhost:${PORT}`)

    // Keeps Mongo caught up with the old Next.js app's still-live Supabase
    // writes, in-process — the external GitHub Actions cron (every 20 min)
    // relied on a scheduled workflow that GitHub auto-disables after 60 days
    // of repo inactivity, which is exactly what let a real backlog build up
    // silently (148 admissions, 169 students, 6 batches missing from Mongo
    // by the time this was caught). Running it here instead ties it to the
    // server's own uptime — no external trigger to go stale. Every 5 minutes
    // is intentionally more frequent than the old 20-minute schedule.
    const runSync = async (label: string) => {
        try {
            const results = await syncFromSupabase()
            const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0)
            if (totalInserted > 0) {
                console.log(`[supabase-sync:${label}] inserted ${totalInserted} row(s):`, results.filter(r => r.inserted > 0).map(r => `${r.collection}+${r.inserted}`).join(', '))
            }
        } catch (err) {
            console.error(`[supabase-sync:${label}] failed:`, err)
        }
    }
    setTimeout(() => runSync('startup'), 5000)
    setInterval(() => runSync('interval'), 5 * 60 * 1000)
})
