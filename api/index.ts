// Vercel serverless entry point. Wraps the same createApp() used by the local/traditional
// server (server/src/index.ts) — no route/behavior changes, just a different way of invoking
// the same Express app per-request instead of a long-lived app.listen() process.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createApp } from '../server/src/app'

const app = createApp()

export default function handler(req: VercelRequest, res: VercelResponse) {
    return app(req as any, res as any)
}
