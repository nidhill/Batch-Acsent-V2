import { Router } from 'express'

const router = Router()

// ---- Ported from src/app/api/proxy/verify-webhook/route.ts ----
router.post('/verify-webhook', async (req, res) => {
    try {
        const body = req.body
        const isProd = process.env.NODE_ENV === 'production'

        const webhookUrl = isProd
            ? 'https://purpletech.app.n8n.cloud/webhook/bcc93a8e-ce14-41e8-ad43-265a66a7ddd7'
            : 'https://purpletech.app.n8n.cloud/webhook-test/bcc93a8e-ce14-41e8-ad43-265a66a7ddd7'

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`)
        }

        const data = await response.text() // n8n might return text or json
        res.json({ success: true, data })
    } catch (err: any) {
        console.error('Proxy Error Full:', err)
        console.error('Proxy Error Message:', err.message)
        res.status(500).json({ error: err.message, stack: err.stack })
    }
})

export default router
