// Ported unchanged from src/lib/constants.ts. Duplicated (not shared-package-imported) into
// both server/ and client/ — small, zero-dependency file, not worth a shared workspace
// package for a monorepo this size. Keep both copies in sync if these values change.
export const SCHOOLS = [
    'Tech School',
    'Marketing School',
    'Design School',
    'Finance School'
] as const

export const ROLES = {
    ADMIN: 'ADMIN',
    SHO: 'SHO',
    ACADEMIC_LEAD: 'ACADEMIC_LEAD',
    SALES: 'SALES',
    BUSINESS_HEAD: 'BUSINESS_HEAD', // renamed from PROJECT_LEAD per SRS V2
    SSHO: 'SSHO',
    SALES_HEAD: 'SALES_HEAD',
    CEO: 'CEO',
    PENDING: 'PENDING'
} as const

// SRS Doc 3/6: payment status options and the 7 supported payment methods
export const PAYMENT_STATUSES = [
    { value: 'full', label: 'Full Payment' },
    { value: 'advance', label: 'Advance Payment' },
    { value: 'partial', label: 'Partial Payment' },
    { value: 'emi', label: 'EMI' },
] as const

export const PAYMENT_METHODS = [
    { value: 'easybuzz', label: 'EasyBuzz' },
    { value: 'bajaj_finance', label: 'Bajaj Finance' },
    { value: 'propel', label: 'Propel' },
    { value: 'ots', label: 'OTS' },
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
] as const

export const PAYMENT_CHANNELS = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
] as const

export const LEAD_SOURCES = [
    { value: 'inbound_call', label: 'Inbound call' },
    { value: 'walk_in', label: 'Walk in' },
    { value: 'google_ads', label: 'Google ads' },
    { value: 'workshop_webinar', label: 'Workshop/Webinar' },
    { value: 'fb_leads_ad', label: 'FB leads ad' },
    { value: 'meta_re_engaged_leads', label: 'Meta Re-Engaged Leads' },
    { value: 'whatsapp_inbound', label: 'WhatsApp Inbound' },
    { value: 'offline_campaigns', label: 'Offline campaigns' },
    { value: 'website_referral_sites', label: 'Website/Referral sites' },
    { value: 'pr', label: 'PR' },
    { value: 'seo', label: 'SEO' },
    { value: 'smm_instagram', label: 'SMM Instagram' },
    { value: 'social_media_re_engaged_leads', label: 'Social media Re-engaged leads' },
    { value: 'smm_youtube', label: 'SMM YouTube' },
    { value: 'whatsapp_reactivation', label: 'WhatsApp reactivation' },
    { value: 'student_referrals', label: 'Student referrals' },
    { value: 'staff_referrals', label: 'Staff referrals' },
    { value: 'networking_referrals', label: 'Networking referrals' },
] as const
