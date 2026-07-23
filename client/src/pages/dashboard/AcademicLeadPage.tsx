import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import DashboardFilterBar, { rangeToDates } from '@/components/DashboardFilterBar'
import type { DashboardFilters } from '@/components/DashboardFilterBar'

// SRS Doc 4 §4 "Dashboard" — Academic Lead previously shared the generic to-do-list Overview
// (Pending Verifications / Pending Calls only) with no batch-status cards, Total Students,
// Students Awaiting SHO Assignment, or Batch Utilization %. This is the dedicated page.
export default function AcademicLeadPage() {
    const [filters, setFilters] = useState<DashboardFilters>({ range: 'this_month', region: '', school: '', course: '' })
    const [data, setData] = useState<any>(null)
    const [batches, setBatches] = useState<any[]>([])
    const [awaitingSho, setAwaitingSho] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        setLoading(true)
        setError(null)
        try {
            const { from, to } = rangeToDates(filters.range)
            const params = new URLSearchParams({ from, to })
            if (filters.region) params.set('region', filters.region)
            if (filters.school) params.set('school', filters.school)
            if (filters.course) params.set('course', filters.course)

            const [analyticsRes, batchesRes] = await Promise.all([
                authedFetch(`/api/analytics/overview?${params.toString()}`),
                authedFetch('/api/batches?view=all'),
            ])
            const analyticsJson = await analyticsRes.json()
            const batchesJson = await batchesRes.json()
            if (analyticsRes.ok) {
                setData(analyticsJson)
            } else {
                setError(analyticsJson.error || 'Failed to load the dashboard.')
            }
            if (batchesRes.ok) {
                const bs = batchesJson.batches || []
                setBatches(bs)
                const withoutSho = bs.filter((b: any) => !b.sho_name)
                const count = withoutSho.reduce((s: number, b: any) => s + (b.enrolled_count || 0), 0)
                setAwaitingSho(count)
            }
        } catch (err) {
            console.error('Error loading Academic Lead dashboard:', err)
            setError('Failed to load the dashboard. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters])

    if (loading) return <div className="animate-pulse">Loading dashboard...</div>

    if (error) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--error)', fontWeight: 600, marginBottom: '1rem' }}>{error}</div>
                <button className="btn btn-primary" onClick={load}>Retry</button>
            </div>
        )
    }

    if (!data) return null

    const t = data.totals || {}

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Academic Lead Dashboard</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Batch planning, verification and SHO assignment at a glance.</p>

            <DashboardFilterBar filters={filters} onChange={setFilters} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Upcoming Batches</div>
                    <div className="kpi-value">{t.batches_upcoming ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Running Batches</div>
                    <div className="kpi-value">{t.batches_running ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Completed Batches</div>
                    <div className="kpi-value">{t.batches_completed ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Full Batches</div>
                    <div className="kpi-value">{t.batches_full ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Total Students</div>
                    <div className="kpi-value">{t.total_admissions ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Pending Verification</div>
                    <div className="kpi-value" style={{ color: 'var(--warning)' }}>{t.pending_verification ?? 0}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Awaiting SHO Assignment</div>
                    <div className="kpi-value">{awaitingSho}</div>
                </div>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">Batch Utilization</div>
                    <div className="kpi-value">{data.batch_utilization_percentage ?? 0}%</div>
                </div>
            </div>

            <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <a href="/dashboard/verification-queue" className="btn btn-primary">Go to Verification Queue</a>
                <a href="/dashboard/create-batch" className="btn btn-secondary">Create Batch</a>
                <a href="/dashboard/batches" className="btn btn-secondary">View All Batches ({batches.length})</a>
            </div>
        </div>
    )
}
