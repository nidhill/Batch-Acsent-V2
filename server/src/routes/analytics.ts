import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'
import { can } from '../lib/permissions'
import { getLmsAccessPolicy, evaluateLmsAccess } from '../lib/lmsAccessPolicy'

const router = Router()

// Shared analytics engine behind every role dashboard (Admin/CEO/Business Head/Sales Head/
// Academic Lead) — SRS Docs 2-4 each ask for overlapping breakdowns of the same underlying
// admissions/payments/batches data, just with different scoping and visibility. One endpoint,
// role-scoped, rather than duplicating aggregation logic per dashboard.
// ---- Ported from src/app/api/analytics/overview/route.ts ----
router.get('/overview', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        const region = req.query.region as string | undefined
        const school = req.query.school as string | undefined
        const course = req.query.course as string | undefined
        const batchId = req.query.batch_id as string | undefined
        const from = req.query.from as string | undefined
        const to = req.query.to as string | undefined

        const db = await getDb()
        const isSuperUser = ['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(profile.role)
        const canSeeRevenue = can(profile.role, 'VIEW_REVENUE_DASHBOARD')

        // ---- Resolve the batch scope every other query filters through ----
        const batchFilter: Record<string, any> = {}
        if (region) batchFilter.region = region
        if (school) batchFilter.school = school
        if (course) batchFilter.course = course
        if (batchId) batchFilter._id = batchId
        if (!isSuperUser && profile.role !== 'SALES_HEAD' && profile.school) batchFilter.school = profile.school
        if (profile.role === 'SALES_HEAD' && profile.school && !school) batchFilter.school = profile.school

        const batches = await db.collection('ba_batches').find(batchFilter).toArray()
        const batchIds = batches.map(b => b._id)
        const batchMap = new Map(batches.map(b => [b._id, b]))

        // ---- Admissions in scope ----
        const admissionFilter: Record<string, any> = { batch_id: { $in: batchIds } }
        if (from || to) {
            admissionFilter.enrolled_at = {}
            if (from) admissionFilter.enrolled_at.$gte = from
            if (to) admissionFilter.enrolled_at.$lte = to
        }
        if (profile.role === 'SALES' && profile.sales_id) admissionFilter.sales_id = profile.sales_id

        const admissions = await db.collection('ba_admissions').find(admissionFilter).toArray()
        const admissionIds = admissions.map(a => a._id)

        // ---- Batches per school/course (Admin "Manage Schools & Courses" analytics) ----
        const batchesBySchool: Record<string, number> = {}
        const batchesByCourse: Record<string, number> = {}
        batches.forEach(b => {
            if (b.school) batchesBySchool[b.school] = (batchesBySchool[b.school] || 0) + 1
            if (b.course) batchesByCourse[b.course] = (batchesByCourse[b.course] || 0) + 1
        })

        // ---- Batch status breakdown ----
        const todayStr = new Date().toISOString().split('T')[0]
        const batchStatus = { upcoming: 0, running: 0, full: 0, completed: 0 }
        batches.forEach(b => {
            const enrolledCount = admissions.filter(a => a.batch_id === b._id).length
            if (b.strength && enrolledCount >= b.strength) batchStatus.full++
            else if (b.end_date && b.end_date < todayStr) batchStatus.completed++
            else if (b.start_date && b.start_date <= todayStr) batchStatus.running++
            else batchStatus.upcoming++
        })

        // ---- Revenue ----
        let revenue = { total: 0, collected: 0, pending: 0, collection_percentage: 0 }
        let revenueByRegion: Record<string, number> = {}
        let revenueBySchool: Record<string, number> = {}
        let revenueByCourse: Record<string, number> = {}
        let paymentMethodBreakdown: Record<string, { revenue: number; students: number }> = {}
        let salesLeaderboard: Record<string, { admissions: number; revenue: number }> = {}

        if (canSeeRevenue && admissionIds.length > 0) {
            const payments = await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            const paymentMap = new Map(payments.map(p => [p.admission_id, p]))

            payments.forEach(p => {
                revenue.total += p.final_fee || 0
                revenue.collected += p.amount_paid || 0
                revenue.pending += p.remaining_amount || 0
            })
            revenue.collection_percentage = revenue.total > 0 ? Math.round((revenue.collected / revenue.total) * 100) : 0

            admissions.forEach(a => {
                const payment = paymentMap.get(a._id)
                if (!payment) return
                const batch = batchMap.get(a.batch_id)
                if (batch?.region) revenueByRegion[batch.region] = (revenueByRegion[batch.region] || 0) + payment.amount_paid
                if (batch?.school) revenueBySchool[batch.school] = (revenueBySchool[batch.school] || 0) + payment.amount_paid
                if (batch?.course) revenueByCourse[batch.course] = (revenueByCourse[batch.course] || 0) + payment.amount_paid
                if (a.sales_id) {
                    salesLeaderboard[a.sales_id] = salesLeaderboard[a.sales_id] || { admissions: 0, revenue: 0 }
                    salesLeaderboard[a.sales_id].admissions++
                    salesLeaderboard[a.sales_id].revenue += payment.amount_paid || 0
                }
            })

            const txns = await db.collection('ba_payment_transactions').find({ admission_id: { $in: admissionIds } }).toArray()
            txns.forEach(t => {
                if (!t.method) return
                paymentMethodBreakdown[t.method] = paymentMethodBreakdown[t.method] || { revenue: 0, students: 0 }
                paymentMethodBreakdown[t.method].revenue += t.amount || 0
                paymentMethodBreakdown[t.method].students += 1
            })
        }

        // Resolve sales_id -> name for the leaderboard. Real sales_id data has stray
        // whitespace/casing inconsistencies (e.g. "MS-03 " vs "MS-03") from years of manual
        // entry, so an exact $in match misses real users — fetch everyone with a sales_id and
        // match normalized instead.
        const salesIds = Object.keys(salesLeaderboard)
        const salesUsers = salesIds.length > 0
            ? await db.collection('ba_users').find({ sales_id: { $exists: true, $ne: null } }).project({ name: 1, sales_id: 1 }).toArray()
            : []
        const salesNameMap = new Map(salesUsers.filter(u => u.sales_id).map(u => [String(u.sales_id).trim().toUpperCase(), u.name]))
        const leaderboard = Object.entries(salesLeaderboard)
            .map(([sales_id, v]) => ({ sales_id, name: salesNameMap.get(sales_id.trim().toUpperCase()) || sales_id, ...v }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5)

        // ---- Lead source ----
        const leadSource: Record<string, number> = {}
        admissions.forEach(a => {
            if (a.lead_source) leadSource[a.lead_source] = (leadSource[a.lead_source] || 0) + 1
        })

        // ---- Student demographics (SRS Doc 2 "Location-wise Analysis" / student analytics) ----
        const ageBracket: Record<string, number> = { 'Below 18': 0, '18-22': 0, '23-30': 0, 'Above 30': 0 }
        const gender: Record<string, number> = {}
        const byState: Record<string, number> = {}
        const byCity: Record<string, number> = {}
        const byRegion: Record<string, number> = {}
        const bySchool: Record<string, number> = {}
        const byCourse: Record<string, number> = {}
        admissions.forEach(a => {
            const b = batchMap.get(a.batch_id)
            if (b?.school) bySchool[b.school] = (bySchool[b.school] || 0) + 1
            if (b?.course) byCourse[b.course] = (byCourse[b.course] || 0) + 1
        })
        admissions.forEach(a => {
            if (typeof a.age === 'number') {
                if (a.age < 18) ageBracket['Below 18']++
                else if (a.age <= 22) ageBracket['18-22']++
                else if (a.age <= 30) ageBracket['23-30']++
                else ageBracket['Above 30']++
            }
            if (a.gender) gender[a.gender] = (gender[a.gender] || 0) + 1
            if (a.state) byState[a.state] = (byState[a.state] || 0) + 1
            if (a.city) byCity[a.city] = (byCity[a.city] || 0) + 1
            if (a.region) byRegion[a.region] = (byRegion[a.region] || 0) + 1
        })

        // ---- Admission trend (by month, YYYY-MM) ----
        const admissionTrend: Record<string, number> = {}
        admissions.forEach(a => {
            const d = a.admission_date || a.enrolled_at
            if (!d) return
            const month = String(d).slice(0, 7)
            admissionTrend[month] = (admissionTrend[month] || 0) + 1
        })

        // ---- Turnaround time (lead creation -> admission confirmation) ----
        // Doc 2 §4 asks for average, fastest, slowest and a per-sales-executive breakdown.
        const turnaroundRows = admissions
            .filter(a => a.lead_creation_date && a.admission_date)
            .map(a => ({
                sales_id: a.sales_id,
                days: (new Date(a.admission_date).getTime() - new Date(a.lead_creation_date).getTime()) / (1000 * 60 * 60 * 24),
            }))
            .filter(r => r.days >= 0)
        const turnaroundDays = turnaroundRows.map(r => r.days)
        const avgTurnaround = turnaroundDays.length > 0 ? Math.round((turnaroundDays.reduce((s, d) => s + d, 0) / turnaroundDays.length) * 10) / 10 : null
        const fastestTurnaround = turnaroundDays.length > 0 ? Math.round(Math.min(...turnaroundDays) * 10) / 10 : null
        const slowestTurnaround = turnaroundDays.length > 0 ? Math.round(Math.max(...turnaroundDays) * 10) / 10 : null
        const turnaroundBySales: Record<string, { avg_days: number; count: number }> = {}
        const turnaroundGroups: Record<string, number[]> = {}
        turnaroundRows.forEach(r => {
            if (!r.sales_id) return
            turnaroundGroups[r.sales_id] = turnaroundGroups[r.sales_id] || []
            turnaroundGroups[r.sales_id].push(r.days)
        })
        Object.entries(turnaroundGroups).forEach(([salesId, days]) => {
            turnaroundBySales[salesId] = { avg_days: Math.round((days.reduce((s, d) => s + d, 0) / days.length) * 10) / 10, count: days.length }
        })

        // ---- Payment status distribution (Full/Advance/Partial/EMI student counts) — Business
        // Head / Sales Head "Payment Dashboard" ----
        const paymentStatusCounts: Record<string, number> = {}
        if (canSeeRevenue && admissionIds.length > 0) {
            const payments = await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            payments.forEach(p => {
                if (!p.payment_status) return
                paymentStatusCounts[p.payment_status] = (paymentStatusCounts[p.payment_status] || 0) + 1
            })
        }

        // ---- Batch utilization % ----
        const totalCapacity = batches.reduce((s, b) => s + (b.strength || 0), 0)
        const totalEnrolled = admissions.length
        const batchUtilizationPct = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 1000) / 10 : 0

        // ---- Org-wide counts (CEO Executive Dashboard KPI cards) ----
        const [totalSchools, totalCourses, activeUsers] = isSuperUser
            ? await Promise.all([
                db.collection('schools').countDocuments({}),
                db.collection('ba_courses').countDocuments({}),
                db.collection('ba_users').countDocuments({ role: { $ne: 'PENDING' } }),
            ])
            : [null, null, null]

        // ---- Student lifecycle ----
        const verifiedCount = admissions.filter(a => a.verified_at || a.status === 'Verified').length
        const onboardedCount = admissions.filter(a => a.onboarding_completed).length
        const pendingVerification = admissions.length - verifiedCount - admissions.filter(a => a.status === 'Rejected').length
        const pendingOnboarding = admissions.filter(a => (a.verified_at || a.status === 'Verified') && !a.onboarding_completed).length

        // ---- LMS active students (Doc 2 §9 "Student Lifecycle Analytics") ----
        let lmsActiveCount = 0
        if (admissionIds.length > 0) {
            const allPayments = await db.collection('ba_payments').find({ admission_id: { $in: admissionIds } }).toArray()
            const lmsPolicy = await getLmsAccessPolicy()
            lmsActiveCount = allPayments.filter(p => evaluateLmsAccess(lmsPolicy, p as any)).length
        }

        res.json({
            totals: {
                total_admissions: admissions.length,
                total_batches: batches.length,
                batches_upcoming: batchStatus.upcoming,
                batches_running: batchStatus.running,
                batches_full: batchStatus.full,
                batches_completed: batchStatus.completed,
                pending_verification: pendingVerification,
                pending_onboarding: pendingOnboarding,
                onboarded: onboardedCount,
                total_schools: totalSchools,
                total_courses: totalCourses,
                active_users: activeUsers,
                lms_active_students: lmsActiveCount,
            },
            revenue: canSeeRevenue ? revenue : null,
            revenue_by_region: canSeeRevenue ? revenueByRegion : null,
            revenue_by_school: canSeeRevenue ? revenueBySchool : null,
            revenue_by_course: canSeeRevenue ? revenueByCourse : null,
            payment_method_breakdown: canSeeRevenue ? paymentMethodBreakdown : null,
            sales_leaderboard: canSeeRevenue ? leaderboard : null,
            lead_source: leadSource,
            avg_turnaround_days: avgTurnaround,
            fastest_turnaround_days: fastestTurnaround,
            slowest_turnaround_days: slowestTurnaround,
            turnaround_by_sales: turnaroundBySales,
            payment_status_counts: canSeeRevenue ? paymentStatusCounts : null,
            batch_utilization_percentage: batchUtilizationPct,
            age_bracket: ageBracket,
            gender,
            by_state: byState,
            by_city: byCity,
            admissions_by_region: byRegion,
            admissions_by_school: bySchool,
            admissions_by_course: byCourse,
            batches_by_school: batchesBySchool,
            batches_by_course: batchesByCourse,
            admission_trend: admissionTrend,
        })
    } catch (err) {
        next(err)
    }
})

export default router
