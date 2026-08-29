import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Trophy } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { rangeToDates } from '@/components/DashboardFilterBar'

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']
const LEADERBOARD_PERIODS = [
    { value: 'today', label: 'Daily' },
    { value: 'this_week', label: 'Weekly' },
    { value: 'this_month', label: 'Monthly' },
    { value: 'this_year', label: 'Yearly' },
]

interface Batch {
    id: string
    name: string
    course: string
    start_date: string
    strength: number
    enrolled_count?: number
}

interface SalesStats {
    total_enrollments: number
    this_month: number
}

export default function SalesPage() {
    const navigate = useNavigate()
    const [batches, setBatches] = useState<Batch[]>([])
    const [stats, setStats] = useState<SalesStats>({ total_enrollments: 0, this_month: 0 })
    const [loading, setLoading] = useState(true)
    // Fetch failures (a Render cold-start timeout, a dropped connection) were previously
    // swallowed to console.error only — the page rendered the untouched default state (0
    // enrollments, an empty batches list), which is visually identical to a real empty
    // account. This makes failures visible instead of silently masquerading as real zeros.
    const [loadError, setLoadError] = useState(false)
    const [userSchool, setUserSchool] = useState<string | null>(null)
    const [salesId, setSalesId] = useState<string | null>(null)

    const [userRole, setUserRole] = useState<string | null>(null)
    const [revenue, setRevenue] = useState<any>(null)
    // Always "this calendar month", independent of the Daily/Weekly/Monthly/Yearly leaderboard
    // filter below — so there's a stable answer to "how much this month" even when someone's
    // browsing a different period.
    const [thisMonthRevenue, setThisMonthRevenue] = useState<any>(null)
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [analytics, setAnalytics] = useState<any>(null)
    const [leaderboardPeriod, setLeaderboardPeriod] = useState('this_month')
    const [targets, setTargets] = useState<Record<string, number>>({})
    const [courseFilter, setCourseFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'full'>('all')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserSchool(localStorage.getItem('userSchool'))
            setSalesId(localStorage.getItem('salesId'))
            setUserRole(localStorage.getItem('userRole'))
        }
        loadAll()
        fetchThisMonthRevenue()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        fetchRevenue()
        fetchTargets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaderboardPeriod])

    const loadAll = () => {
        setLoadError(false)
        Promise.all([fetchBatches(), fetchStats()]).catch(() => setLoadError(true))
    }

    const fetchTargets = async () => {
        try {
            const month = new Date().toISOString().slice(0, 7)
            const res = await authedFetch(`/api/sales-targets?month=${month}`)
            const data = await res.json()
            if (!res.ok) return
            const map: Record<string, number> = {}
                ; (data.targets || []).forEach((t: any) => { map[t.sales_id] = t.target_amount })
            setTargets(map)
        } catch (err) {
            console.error('Error fetching sales targets:', err)
        }
    }

    const setTarget = async (targetSalesId: string) => {
        const amount = prompt('Monthly revenue target (₹) for this Sales Executive:')
        if (amount === null) return
        try {
            const res = await authedFetch('/api/sales-targets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sales_id: targetSalesId, month: new Date().toISOString().slice(0, 7), target_amount: parseFloat(amount) || 0 }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            fetchTargets()
        } catch (err: any) {
            alert('Error setting target: ' + err.message)
        }
    }

    const fetchRevenue = async () => {
        try {
            const { from, to } = rangeToDates(leaderboardPeriod)
            const res = await authedFetch(`/api/analytics/overview?from=${from}&to=${to}`)
            const data = await res.json()
            if (!res.ok) return
            setRevenue(data.revenue)
            setLeaderboard(data.sales_leaderboard || [])
            setAnalytics(data)
        } catch (error) {
            console.error('Error fetching revenue analytics:', error)
        }
    }

    const fetchThisMonthRevenue = async () => {
        try {
            const { from, to } = rangeToDates('this_month')
            const res = await authedFetch(`/api/analytics/overview?from=${from}&to=${to}`)
            const data = await res.json()
            if (!res.ok) return
            setThisMonthRevenue(data.revenue)
        } catch (error) {
            console.error('Error fetching this month revenue:', error)
        }
    }

    const fetchBatches = async () => {
        try {
            const res = await authedFetch('/api/batches?view=all')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBatches(data.batches || [])
        } catch (error) {
            console.error('Error fetching batches:', error)
            throw error
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const res = await authedFetch('/api/admissions/stats')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setStats(data)
        } catch (error) {
            console.error('Error fetching stats:', error)
            throw error
        }
    }

    if (loading) return <div>Loading...</div>

    if (loadError) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: 'var(--error)', fontWeight: 600, marginBottom: '1rem' }}>
                    Couldn't load the dashboard — the server may still be starting up. Try again in a few seconds.
                </div>
                <button className="btn btn-primary" onClick={() => { setLoading(true); loadAll() }}>Retry</button>
            </div>
        )
    }

    // Sales and Sales Head only need batches they can actually still enroll students into —
    // upcoming ones, plus recently-started ones (late admissions are common in the first
    // month). Older running/past batches belong on Past Batches, not clutter here. Admin/CEO/
    // Business Head land on this same page for oversight and keep seeing everything.
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const scopeToRecentAndUpcoming = ['SALES', 'SALES_HEAD'].includes(userRole || '')

    const courseOptions = Array.from(new Set(batches.map(b => b.course).filter(Boolean))).sort()
    const filteredBatches = batches.filter(batch => {
        if (scopeToRecentAndUpcoming && new Date(batch.start_date) < oneMonthAgo) return false
        if (courseFilter && batch.course !== courseFilter) return false
        const isFull = ((batch.enrolled_count || 0) / batch.strength) * 100 >= 100
        if (statusFilter === 'open' && isFull) return false
        if (statusFilter === 'full' && !isFull) return false
        return true
    })

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Sales Dashboard</h2>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">{userRole === 'SALES_HEAD' ? 'School Enrollments' : 'Total Enrollments'}</div>
                    <div className="kpi-value">{stats.total_enrollments}</div>
                </div>

                <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div className="kpi-label">This Month</div>
                    <div className="kpi-value">{stats.this_month}</div>
                </div>

                {/* Only show Sales ID card for SALES role */}
                {userRole === 'SALES' && (
                    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                        <div className="kpi-label">Your Sales ID</div>
                        <div className="kpi-value" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>{salesId || 'Not assigned'}</div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>Use this ID when filling enrollment forms</p>
                    </div>
                )}
            </div>

            {/* Revenue Dashboard — visible only to roles with VIEW_REVENUE_DASHBOARD permission
                (Sales Head/Admin/CEO/Business Head); Sales Executives only ever see their
                own revenue via the cards above, per SRS Doc 3 §7-8. */}
            {revenue && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                        <div className="kpi-label">Total Revenue</div>
                        <div className="kpi-value">₹{revenue.total.toLocaleString()}</div>
                    </div>
                    {thisMonthRevenue && (
                        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                            <div className="kpi-label">This Month Revenue</div>
                            <div className="kpi-value">₹{thisMonthRevenue.total.toLocaleString()}</div>
                        </div>
                    )}
                    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                        <div className="kpi-label">Collected</div>
                        <div className="kpi-value" style={{ color: 'var(--success)' }}>₹{revenue.collected.toLocaleString()}</div>
                    </div>
                    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                        <div className="kpi-label">Pending Collection</div>
                        <div className="kpi-value" style={{ color: 'var(--warning)' }}>₹{revenue.pending.toLocaleString()}</div>
                    </div>
                    <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                        <div className="kpi-label">Collection Rate</div>
                        <div className="kpi-value">{revenue.collection_percentage}%</div>
                    </div>
                </div>
            )}

            {/* Payment Dashboard (Doc 3 §"Sales Head" — Full/Advance/EMI/Partial student counts) */}
            {['SALES_HEAD', 'ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && analytics?.payment_status_counts && (
                <div className="card" style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Payment Dashboard</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        {['full', 'advance', 'partial', 'emi'].map(status => (
                            <div key={status} style={{ padding: '0.85rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <div className="kpi-label" style={{ textTransform: 'capitalize' }}>{status} Payment Students</div>
                                <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{analytics.payment_status_counts[status] || 0}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {leaderboard.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <Trophy size={20} color="#eab308" /> Sales Leaderboard
                        </h3>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                            {LEADERBOARD_PERIODS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setLeaderboardPeriod(p.value)}
                                    className={`btn ${leaderboardPeriod === p.value ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {leaderboard.map((s, i) => {
                            const target = targets[s.sales_id]
                            const achievement = target ? Math.round((s.revenue / target) * 1000) / 10 : null
                            return (
                                <div key={s.sales_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: i === 0 ? 'var(--surface-hover)' : 'transparent', borderRadius: '0.375rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600 }}>#{i + 1} {s.name}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {s.admissions} admissions · ₹{s.revenue.toLocaleString()}
                                        {target ? (
                                            <span style={{ fontWeight: 600, color: achievement && achievement >= 100 ? '#16a34a' : '#b45309' }}>
                                                {achievement}% of ₹{target.toLocaleString()} target
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-tertiary)' }}>No target set</span>
                                        )}
                                        {['SALES_HEAD', 'ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && (
                                            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => setTarget(s.sales_id)}>
                                                {target ? 'Edit Target' : 'Set Target'}
                                            </button>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Lead source / payment method breakdowns — SRS Doc 4 Sales Head "lead-source and
                payment-method analytics", computed by the shared analytics API but not charted
                anywhere until now. */}
            {['SALES_HEAD', 'ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && analytics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="card">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Lead Source Breakdown</h3>
                        {Object.keys(analytics.lead_source || {}).length > 0 ? (
                            <div style={{ height: '260px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                    <PieChart>
                                        <Pie
                                            data={Object.entries(analytics.lead_source || {}).map(([name, value]) => ({ name, value }))}
                                            cx="50%" cy="50%" outerRadius={90} dataKey="value"
                                            label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {Object.keys(analytics.lead_source || {}).map((_, index) => (
                                                <Cell key={`ls-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No lead source data yet.</p>
                        )}
                    </div>
                    <div className="card">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Revenue by Payment Method</h3>
                        {analytics.payment_method_breakdown && Object.keys(analytics.payment_method_breakdown).length > 0 ? (
                            <div style={{ height: '260px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                    <BarChart data={Object.entries(analytics.payment_method_breakdown).map(([name, v]: [string, any]) => ({ name, revenue: v.revenue }))}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                        <Bar dataKey="revenue" fill="#FF8042" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No payment data yet.</p>
                        )}
                    </div>
                    <div className="card">
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: analytics.revenue_by_course && Object.keys(analytics.revenue_by_course).length > 0 ? '0.25rem' : '1.5rem' }}>Revenue by Program</h3>
                        {analytics.revenue_by_course && Object.keys(analytics.revenue_by_course).length > 0 ? (() => {
                            // Sorted highest-first so the top-earning program is always the
                            // leftmost/tallest bar, not just whatever order Object.entries()
                            // happened to return.
                            const sorted = Object.entries(analytics.revenue_by_course as Record<string, number>)
                                .map(([name, revenue]) => ({ name, revenue }))
                                .sort((a, b) => b.revenue - a.revenue)
                            const top = sorted[0]
                            return (
                                <>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                        Top: <strong style={{ color: 'var(--text-primary)' }}>{top.name}</strong> (₹{top.revenue.toLocaleString()})
                                    </p>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <BarChart data={sorted}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                                    {sorted.map((entry, index) => (
                                                        <Cell key={entry.name} fill={index === 0 ? '#8884d8' : '#c4c1ea'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </>
                            )
                        })() : (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No program revenue data yet.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Batches Table */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Available Batches - {userSchool}</h3>
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <select className="input" value={courseFilter} onChange={e => setCourseFilter(e.target.value)} style={{ fontSize: '0.85rem', width: 'auto' }}>
                            <option value="">All Courses</option>
                            {courseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} style={{ fontSize: '0.85rem', width: 'auto' }}>
                            <option value="all">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="full">Full</option>
                        </select>
                    </div>
                </div>
                {filteredBatches.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No batches match this filter.</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                        {filteredBatches.map(batch => {
                            const fillPercentage = ((batch.enrolled_count || 0) / batch.strength) * 100
                            const isFull = fillPercentage >= 100
                            // Open/Full alone gave no warning before a batch actually filled up —
                            // a rep could be one enrollment away from Full with no signal to act
                            // on. Almost Full (80%+) closes that gap.
                            const isAlmostFull = !isFull && fillPercentage >= 80
                            const statusLabel = isFull ? 'Full' : isAlmostFull ? 'Almost Full' : 'Open'
                            const statusBg = isFull ? '#fee2e2' : isAlmostFull ? '#ffedd5' : '#dbeafe'
                            const statusColor = isFull ? '#dc2626' : isAlmostFull ? '#c2410c' : '#2563eb'
                            const barColor = isFull ? '#ef4444' : isAlmostFull ? '#f97316' : 'var(--primary)'

                            return (
                                <div
                                    key={batch.id}
                                    onClick={() => navigate(`/dashboard/sales/batch/${batch.id}`)}
                                    style={{
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '1.1rem',
                                        cursor: 'pointer',
                                        transition: 'box-shadow 0.15s, border-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
                                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border)' }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{batch.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>{batch.id}</div>
                                        </div>
                                        <span style={{
                                            flexShrink: 0,
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            background: statusBg,
                                            color: statusColor
                                        }}>
                                            {statusLabel}
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>{batch.course}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '0.9rem' }}>
                                        Starts {new Date(batch.start_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${Math.min(fillPercentage, 100)}%`,
                                                height: '100%',
                                                background: barColor,
                                                transition: 'width 0.3s, background 0.3s'
                                            }} />
                                        </div>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '600', flexShrink: 0 }}>
                                            {batch.enrolled_count}/{batch.strength}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
