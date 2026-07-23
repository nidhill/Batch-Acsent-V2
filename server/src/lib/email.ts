import { Resend } from 'resend'

// SRS Doc 6 §4 lists email as a current requirement (not "Future" like WhatsApp/push), but
// sending real email needs a Resend API key + verified sending domain that only the account
// owner has. This stays a safe no-op (logs and returns) until RESEND_API_KEY/RESEND_FROM_EMAIL
// are set in the environment — nothing else in the app breaks if they're never configured.
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return null
    if (!resendClient) resendClient = new Resend(apiKey)
    return resendClient
}

export async function sendEmail(params: { to: string; subject: string; html: string }) {
    const client = getResendClient()
    const from = process.env.RESEND_FROM_EMAIL
    if (!client || !from) {
        console.log(`[email] Skipped (Resend not configured): "${params.subject}" -> ${params.to}`)
        return
    }
    try {
        await client.emails.send({ from, to: params.to, subject: params.subject, html: params.html })
    } catch (err) {
        console.error('sendEmail failed (non-fatal):', err)
    }
}

export function notificationEmailHtml(title: string, message: string, link?: string | null) {
    // Renamed from NEXT_PUBLIC_APP_URL during the MERN port — this was always read server-side
    // only (confirmed: no client code referenced it), so the "public" prefix was misleading.
    const appUrl = process.env.APP_URL || ''
    const button = link
        ? `<p><a href="${appUrl}${link}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">View in Batch Ascent</a></p>`
        : ''
    return `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="color:#111;">${title}</h2>
            <p style="color:#374151;">${message}</p>
            ${button}
        </div>
    `
}
