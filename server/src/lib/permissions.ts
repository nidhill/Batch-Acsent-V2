import { ROLES } from './constants'

type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * Ported unchanged from src/lib/permissions.ts. Central role→permission matrix. Extend this
 * instead of adding new ad hoc role checks in individual route files.
 */
export const PERMISSIONS = {
    MANAGE_USERS: [ROLES.ADMIN],
    MANAGE_SCHOOLS_COURSES: [ROLES.ADMIN],
    // Separate from MANAGE_SCHOOLS_COURSES (schools stay Admin-only) — Academic Lead creates
    // batches and is the one who actually needs to add a missing course.
    MANAGE_COURSES: [ROLES.ADMIN, ROLES.ACADEMIC_LEAD],
    VIEW_ACTIVITY_LOGS: [ROLES.ADMIN, ROLES.CEO, ROLES.BUSINESS_HEAD],
    CREATE_EDIT_BATCH: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD],
    DELETE_BATCH: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD],
    VERIFY_STUDENT: [ROLES.ADMIN, ROLES.CEO, ROLES.SALES_HEAD, ROLES.ACADEMIC_LEAD],
    LINK_STUDENT: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD, ROLES.SALES_HEAD],
    CALL_STUDENT: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD, ROLES.SALES_HEAD],
    DELETE_STUDENT: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD, ROLES.SALES_HEAD],
    VIEW_ALL_SCHOOLS: [ROLES.ADMIN, ROLES.CEO, ROLES.BUSINESS_HEAD],
    VIEW_PAYMENT_DETAILS: [ROLES.ADMIN, ROLES.CEO, ROLES.BUSINESS_HEAD, ROLES.SALES_HEAD, ROLES.SALES],
    VIEW_REVENUE_DASHBOARD: [ROLES.ADMIN, ROLES.CEO, ROLES.BUSINESS_HEAD, ROLES.SALES_HEAD, ROLES.SALES],
} as const satisfies Record<string, readonly Role[]>

export function can(role: string | null | undefined, permission: keyof typeof PERMISSIONS): boolean {
    if (!role) return false
    return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
