import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
    Users, TrendingUp, IndianRupee, BookOpen, School, Target, Clock, Award, Activity,
} from 'lucide-react'
import DashboardFilterBar, { rangeToDates } from '@/components/DashboardFilterBar'
import type { DashboardFilters } from '@/components/DashboardFilterBar'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ec4899']

function Kpi({ label, value }: { label: string; value: string | number; icon?: React.ReactNode; color?: string }) {
    return (
        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value">{value}</div>
        </div>
    )
}

// SRS Doc 2 §2 "Executive Dashboard" — CEO gets its own KPI set and analytics distinct from
// the shared Admin/Business Head Overview (12 cards, lead analytics, turnaround time,
// A-Z business intelligence). This was previously just aliased to the shared Overview.
export default function CeoPage() {
    const [filters, setFilters] = useState<DashboardFilters>({ range: 'this_month', region: '', school: '', course: '' })
    const [data, setData] = useState<any>(null)
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
            const res = await authedFetch(`/api/analytics/overview?${params.toString()}`)
            const json = await res.json()
            if (res.ok) setData(json)
            else setError(json.error || 'Failed to load the executive dashboard.')
        } catch (err) {
            console.error('Error loading executive dashboard:', err)
            setError('Failed to load the executive dashboard. Check your connection and try again.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters])

    if (loading) return <div className="animate-pulse">Loading executive dashboard...</div>

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
    const rev = data.revenue || { total: 0, collected: 0, pending: 0, collection_percentage: 0 }

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Executive Dashboard</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Complete organization-wide business intelligence.</p>

            <DashboardFilterBar filters={filters} onChange={setFilters} />

            {/* 1. KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <Kpi label="Total Leads" value={data.total_leads ?? 0} icon={<Target size={20} />} color="#6366f1" />
                <Kpi label="Total Admissions" value={t.total_admissions ?? 0} icon={<Users size={20} />} color="#3b82f6" />
                <Kpi label="Active Students" value={t.onboarded ?? 0} icon={<Award size={20} />} color="#16a34a" />
                <Kpi label="Running Batches" value={t.batches_running ?? 0} icon={<BookOpen size={20} />} color="#059669" />
                <Kpi label="Upcoming Batches" value={t.batches_upcoming ?? 0} icon={<BookOpen size={20} />} color="#0891b2" />
                <Kpi label="Completed Batches" value={t.batches_completed ?? 0} icon={<BookOpen size={20} />} color="#6b7280" />
                <Kpi label="Total Revenue" value={`₹${(rev.total || 0).toLocaleString()}`} icon={<IndianRupee size={20} />} color="#a855f7" />
                <Kpi label="Revenue Collected" value={`₹${(rev.collected || 0).toLocaleString()}`} icon={<IndianRupee size={20} />} color="#16a34a" />
                <Kpi label="Outstanding Revenue" value={`₹${(rev.pending || 0).toLocaleString()}`} icon={<IndianRupee size={20} />} color="#b45309" />
                <Kpi label="Collection %" value={`${rev.collection_percentage || 0}%`} icon={<TrendingUp size={20} />} color="#ec4899" />
                <Kpi label="Total Schools" value={t.total_schools ?? '—'} icon={<School size={20} />} color="#0284c7" />
                <Kpi label="Total Courses" value={t.total_courses ?? '—'} icon={<BookOpen size={20} />} color="#7c3aed" />
            </div>

            {/* 3. Lead Analytics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Lead Conversion</h3>
                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Leads</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{data.total_leads ?? 0}</div></div>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Converted</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{data.converted_leads ?? 0}</div></div>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Conversion Rate</div><div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{data.lead_conversion_rate ?? 0}%</div></div>
                    </div>
                </div>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Clock size={18} /> Turnaround Time (Lead → Admission)</h3>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Average</div><div style={{ fontSize: '1.35rem', fontWeight: 'bold' }}>{data.avg_turnaround_days ?? '—'} days</div></div>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fastest</div><div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--success)' }}>{data.fastest_turnaround_days ?? '—'} days</div></div>
                        <div><div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Slowest</div><div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--warning)' }}>{data.slowest_turnaround_days ?? '—'} days</div></div>
                    </div>
                </div>
            </div>

            {/* Sales Performance */}
            {data.sales_leaderboard && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Sales Leaderboard & Closing Time</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Sales Executive</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Admissions</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Revenue</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>Avg. Closing Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.sales_leaderboard.map((s: any) => (
                                    <tr key={s.sales_id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.5rem' }}>{s.name}</td>
                                        <td style={{ padding: '0.5rem' }}>{s.admissions}</td>
                                        <td style={{ padding: '0.5rem' }}>₹{s.revenue.toLocaleString()}</td>
                                        <td style={{ padding: '0.5rem' }}>{data.turnaround_by_sales?.[s.sales_id]?.avg_days ?? '—'} days</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Batch + Payment + Student Lifecycle */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Batch Analytics</h3>
                    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
                        <div>Total Batches: <strong>{t.total_batches ?? 0}</strong></div>
                        <div>Upcoming: {t.batches_upcoming ?? 0} · Running: {t.batches_running ?? 0} · Full: {t.batches_full ?? 0} · Completed: {t.batches_completed ?? 0}</div>
                        <div>Batch Utilization: <strong>{data.batch_utilization_percentage ?? 0}%</strong></div>
                    </div>
                </div>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Student Lifecycle</h3>
                    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
                        <div>Pending Verification: <strong>{t.pending_verification ?? 0}</strong></div>
                        <div>Pending Onboarding: <strong>{t.pending_onboarding ?? 0}</strong></div>
                        <div>Onboarded Students: <strong>{t.onboarded ?? 0}</strong></div>
                        <div>LMS Active Students: <strong>{t.lms_active_students ?? 0}</strong></div>
                        <div>Agreement Signed: <strong>{data.learner_agreement_status_counts?.signed ?? 0}</strong> / {Object.values(data.learner_agreement_status_counts || {}).reduce((s: number, v: any) => s + v, 0)}</div>
                    </div>
                </div>
                {data.payment_status_counts && (
                    <div className="card">
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Payment Status</h3>
                        <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.9rem' }}>
                            {Object.entries(data.payment_status_counts).map(([status, count]: [string, any]) => (
                                <div key={status} style={{ textTransform: 'capitalize' }}>{status}: <strong>{count}</strong></div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Student / Region Analytics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Student Age Distribution</h3>
                    <div style={{ height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                            <BarChart data={Object.entries(data.age_bracket || {}).map(([name, count]) => ({ name, count }))}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="name" fontSize={11} stroke="var(--text-secondary)" />
                                <YAxis fontSize={11} stroke="var(--text-secondary)" allowDecimals={false} />
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                                <Bar dataKey="count" fill="#0088FE" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>India vs UAE Performance</h3>
                    <div style={{ height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                            <PieChart>
                                <Pie data={Object.entries(data.admissions_by_region || {}).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                                    {Object.keys(data.admissions_by_region || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Lead Source Performance</h3>
                    <div style={{ height: '240px' }}>
                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                            <PieChart>
                                <Pie data={Object.entries(data.lead_source || {}).map(([name, value]) => ({ name, value }))} cx="50%" cy="50%" outerRadius={85} dataKey="value" label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>
                                    {Object.keys(data.lead_source || {}).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Activity size={18} />
                <span>Need more detail? Full exportable Executive Reports live on the <a href="/dashboard/reports" style={{ color: 'var(--primary)' }}>Reports</a> page.</span>
            </div>
        </div>
    )
}
