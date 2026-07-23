// Curated list of common disposable/temporary email providers. Sales reps sometimes use these
// (or a placeholder like test@test.com) to get past the "required" field without asking the
// student for their real email — this catches the well-known ones, not a bulletproof filter.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.biz',
    'sharklasers.com', 'grr.la', 'tempmail.com', 'temp-mail.org', 'tempail.com',
    '10minutemail.com', '10minutemail.net', 'throwawaymail.com', 'yopmail.com',
    'trashmail.com', 'dispostable.com', 'fakeinbox.com', 'getnada.com', 'maildrop.cc',
    'mintemail.com', 'mailnesia.com', 'moakt.com', 'discard.email', 'spamgourmet.com',
    'mailcatch.com', 'mailnull.com', 'emailondeck.com', 'byom.de', 'mvrht.net',
    'test.com', 'example.com', 'example.org', 'test.org', 'fake.com',
])

export function isDisposableOrFakeEmail(email: string): boolean {
    const trimmed = (email || '').trim().toLowerCase()
    const domain = trimmed.split('@')[1]
    if (!domain) return false
    return DISPOSABLE_EMAIL_DOMAINS.has(domain)
}
