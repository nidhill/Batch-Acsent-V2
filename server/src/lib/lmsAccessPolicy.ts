import { getDb } from './mongodb'

// Ported unchanged from src/lib/lmsAccessPolicy.ts. SRS Doc 2 §3 (Business Head) asks for an
// "LMS access policy" gated on payment status, but leaves the exact business rule ("finalized
// by management") undefined. Rather than guess a threshold, this stores one configurable
// policy document and computes access from it — management can change the rule from the UI
// without a code change.
export type LmsAccessPolicy = {
    rule_type: 'full_payment' | 'min_percentage' | 'any_payment'
    min_percentage: number
    updated_at?: string
    updated_by?: string
}

const DEFAULT_POLICY: LmsAccessPolicy = { rule_type: 'any_payment', min_percentage: 0 }

export async function getLmsAccessPolicy(): Promise<LmsAccessPolicy> {
    const db = await getDb()
    const doc = await db.collection('ba_settings').findOne({ _id: 'lms_access_policy' as any })
    if (!doc) return DEFAULT_POLICY
    return { rule_type: doc.rule_type, min_percentage: doc.min_percentage, updated_at: doc.updated_at, updated_by: doc.updated_by }
}

export function evaluateLmsAccess(policy: LmsAccessPolicy, payment: { final_fee?: number; amount_paid?: number } | null | undefined): boolean {
    if (!payment || !payment.final_fee) return false
    const paidPct = payment.final_fee > 0 ? ((payment.amount_paid || 0) / payment.final_fee) * 100 : 0
    switch (policy.rule_type) {
        case 'full_payment':
            return paidPct >= 100
        case 'min_percentage':
            return paidPct >= policy.min_percentage
        case 'any_payment':
        default:
            return (payment.amount_paid || 0) > 0
    }
}
