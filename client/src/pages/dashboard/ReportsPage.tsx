import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import { exportToCsv } from '@/lib/exportCsv'
import { exportToXlsx } from '@/lib/exportXlsx'
import { exportToPdf } from '@/lib/exportPdf'
import { FileDown, FileText, FileSpreadsheet } from 'lucide-react'
import DashboardFilterBar, { rangeToDates } from '@/components/DashboardFilterBar'
import type { DashboardFilters } from '@/components/DashboardFilterBar'

type ReportType = 'admissions' | 'batches' | 'payments' | 'students' | 'revenue' | 'schools'
    | 'sales_performance' | 'region' | 'verification' | 'capacity'

export default function ReportsPage() {
    const [reportType, setReportType] = useState<ReportType>('admissions')
    const [filters, setFilters] = useState<DashboardFilters>({ range: 'this_month', region: '', school: '', course: '' })
    const [rows, setRows] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const fetchReport = async () => {
        setLoading(true)
        try {
            if (reportType === 'admissions' || reportType === 'payments') {
                const res = await authedFetch('/api/admissions')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                let admissions = data.admissions || []
                const { from, to } = rangeToDates(filters.range)
                admissions = admissions.filter((a: any) => !a.enrolled_at || (a.enrolled_at >= from && a.enrolled_at <= to))
                if (filters.region) admissions = admissions.filter((a: any) => a.region === filters.region)

                setRows(admissions.map((a: any) => ({
                    student_name: a.student_name,
                    email: a.student_email,
                    phone: a.student_phone,
                    batch: a.batch_name || a.batch_id,
                    region: a.region,
                    status: a.status,
                    lead_source: a.lead_source,
                    enrolled_at: a.enrolled_at,
                    ...(reportType === 'payments' && a.payment ? {
                        course_fee: a.payment.course_fee,
                        final_fee: a.payment.final_fee,
                        amount_paid: a.payment.amount_paid,
                        remaining_amount: a.payment.remaining_amount,
                        payment_status: a.payment.payment_status,
                    } : reportType === 'payments' ? { payment_clearance_status: a.payment_clearance_status } : {}),
                })))
            } else if (reportType === 'students') {
                const res = await authedFetch('/api/admissions')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                let admissions = data.admissions || []
                const { from, to } = rangeToDates(filters.range)
                admissions = admissions.filter((a: any) => !a.enrolled_at || (a.enrolled_at >= from && a.enrolled_at <= to))
                if (filters.region) admissions = admissions.filter((a: any) => a.region === filters.region)

                setRows(admissions.map((a: any) => ({
                    student_name: a.student_name,
                    email: a.student_email,
                    phone: a.student_phone,
                    age: a.age,
                    gender: a.gender,
                    city: a.city,
                    state: a.state,
                    region: a.region,
                    batch: a.batch_name || a.batch_id,
                    status: a.status,
                    onboarding_completed: a.onboarding_completed ? 'Yes' : 'No',
                })))
            } else if (reportType === 'revenue') {
                const res = await authedFetch('/api/analytics/overview')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                const bySchool = data.revenue_by_school || {}
                const byRegion = data.revenue_by_region || {}
                const byCourse = data.revenue_by_course || {}
                const combined: Record<string, any> = {}
                Object.entries(bySchool).forEach(([school, revenue]) => {
                    combined[`school:${school}`] = { dimension: 'School', name: school, revenue_collected: revenue }
                })
                Object.entries(byRegion).forEach(([region, revenue]) => {
                    combined[`region:${region}`] = { dimension: 'Region', name: region, revenue_collected: revenue }
                })
                Object.entries(byCourse).forEach(([course, revenue]) => {
                    combined[`course:${course}`] = { dimension: 'Course', name: course, revenue_collected: revenue }
                })
                setRows(Object.values(combined))
            } else if (reportType === 'schools') {
                const res = await authedFetch('/api/analytics/overview')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                const schoolNames = Array.from(new Set([
                    ...Object.keys(data.batches_by_school || {}),
                    ...Object.keys(data.admissions_by_school || {}),
                ]))
                setRows(schoolNames.map(school => ({
                    school,
                    batches: data.batches_by_school?.[school] || 0,
                    admissions: data.admissions_by_school?.[school] || 0,
                    revenue_collected: data.revenue_by_school?.[school] || 0,
                })))
            } else if (reportType === 'sales_performance') {
                const res = await authedFetch('/api/analytics/overview')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setRows((data.sales_leaderboard || []).map((s: any) => ({
                    sales_executive: s.name,
                    admissions: s.admissions,
                    revenue: s.revenue,
                    avg_closing_time_days: data.turnaround_by_sales?.[s.sales_id]?.avg_days ?? null,
                })))
            } else if (reportType === 'region') {
                const res = await authedFetch('/api/analytics/overview')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                const regionNames = Array.from(new Set([
                    ...Object.keys(data.admissions_by_region || {}),
                    ...Object.keys(data.revenue_by_region || {}),
                ]))
                setRows(regionNames.map(region => ({
                    region,
                    admissions: data.admissions_by_region?.[region] || 0,
                    revenue_collected: data.revenue_by_region?.[region] || 0,
                })))
            } else if (reportType === 'verification') {
                const res = await authedFetch('/api/verification-queue')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setRows((data.items || []).map((i: any) => ({
                    student_name: i.student_name,
                    batch: i.batch_name || i.batch_id,
                    action_type: i.action_type,
                    verification_status: i.verification_status,
                    sales_executive: i.sales_executive,
                    payment_status: i.payment_status,
                    linked_at: i.linked_at,
                })))
            } else if (reportType === 'capacity') {
                const res = await authedFetch('/api/batches?view=all')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                let batches = data.batches || []
                if (filters.region) batches = batches.filter((b: any) => b.region === filters.region)
                if (filters.school) batches = batches.filter((b: any) => b.school === filters.school)

                setRows(batches.map((b: any) => ({
                    batch: b.name,
                    school: b.school,
                    region: b.region,
                    capacity: b.strength || 0,
                    filled: b.enrolled_count || 0,
                    remaining: Math.max(0, (b.strength || 0) - (b.enrolled_count || 0)),
                    utilization_percentage: b.strength ? Math.round(((b.enrolled_count || 0) / b.strength) * 1000) / 10 : 0,
                })))
            } else if (reportType === 'batches') {
                const res = await authedFetch('/api/batches?view=all')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                let batches = data.batches || []
                if (filters.region) batches = batches.filter((b: any) => b.region === filters.region)
                if (filters.school) batches = batches.filter((b: any) => b.school === filters.school)
                if (filters.course) batches = batches.filter((b: any) => (b.course || '').toLowerCase().includes(filters.course.toLowerCase()))

                setRows(batches.map((b: any) => ({
                    id: b.id, name: b.name, course: b.course, school: b.school, region: b.region,
                    start_date: b.start_date, end_date: b.end_date, capacity: b.strength,
                    enrolled: b.enrolled_count, course_fee: b.course_fee, mode: b.mode,
                })))
            }
        } catch (err) {
            console.error('Error fetching report:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReport()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportType, filters])

    const REPORT_TABS: { id: ReportType; label: string }[] = [
        { id: 'admissions', label: 'Admission Report' },
        { id: 'students', label: 'Student Report' },
        { id: 'batches', label: 'Batch Report' },
        { id: 'payments', label: 'Payment Report' },
        { id: 'revenue', label: 'Revenue Report' },
        { id: 'schools', label: 'School Report' },
        { id: 'sales_performance', label: 'Sales Performance' },
        { id: 'region', label: 'Region Report' },
        { id: 'verification', label: 'Verification Report' },
        { id: 'capacity', label: 'Capacity / Utilization' },
    ]

    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={22} /> Reports
            </h2>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {REPORT_TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setReportType(t.id)}
                        className={`btn ${reportType === t.id ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <DashboardFilterBar filters={filters} onChange={setFilters} showCourse={reportType === 'batches'} />

            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{rows.length} rows</span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportToCsv(`${reportType}-report`, rows)}
                            disabled={rows.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                            <FileDown size={16} /> CSV
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportToXlsx(`${reportType}-report`, rows)}
                            disabled={rows.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                            <FileSpreadsheet size={16} /> Excel
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => exportToPdf(`${reportType}-report`, rows, REPORT_TABS.find(t => t.id === reportType)?.label)}
                            disabled={rows.length === 0}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                        >
                            <FileText size={16} /> PDF
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
                ) : rows.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No data for the selected filters.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {columns.map(c => (
                                        <th key={c} style={{ padding: '0.6rem', textAlign: 'left', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(0, 200).map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                        {columns.map(c => (
                                            <td key={c} style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{String(row[c] ?? '—')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {rows.length > 200 && (
                            <p style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Showing first 200 of {rows.length} rows — export CSV for the full set.
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
