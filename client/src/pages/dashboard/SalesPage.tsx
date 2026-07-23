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
    const [userSchool, setUserSchool] = useState<string | null>(null)
    const [salesId, setSalesId] = useState<string | null>(null)

    const [userRole, setUserRole] = useState<string | null>(null)
    const [revenue, setRevenue] = useState<any>(null)
    const [leaderboard, setLeaderboard] = useState<any[]>([])
    const [analytics, setAnalytics] = useState<any>(null)
    const [leaderboardPeriod, setLeaderboardPeriod] = useState('this_month')
    const [targets, setTargets] = useState<Record<string, number>>({})

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserSchool(localStorage.getItem('userSchool'))
            setSalesId(localStorage.getItem('salesId'))
            setUserRole(localStorage.getItem('userRole'))
        }
        fetchBatches()
        fetchStats()
    }, [])

    useEffect(() => {
        fetchRevenue()
        fetchTargets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leaderboardPeriod])

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

    const fetchBatches = async () => {
        try {
            const res = await authedFetch('/api/batches?view=all')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBatches(data.batches || [])
        } catch (error) {
            console.error('Error fetching batches:', error)
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
        }
    }

    if (loading) return <div>Loading...</div>

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
                    {Object.keys(analytics.lead_source || {}).length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Lead Source Breakdown</h3>
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
                        </div>
                    )}
                    {analytics.payment_method_breakdown && Object.keys(analytics.payment_method_breakdown).length > 0 && (
                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Revenue by Payment Method</h3>
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
                        </div>
                    )}
                </div>
            )}

            {/* Batches Table */}
            <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Available Batches - {userSchool}</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem' }}>Batch ID</th>
                                <th style={{ padding: '1rem' }}>Name</th>
                                <th style={{ padding: '1rem' }}>Course</th>
                                <th style={{ padding: '1rem' }}>Start Date</th>
                                <th style={{ padding: '1rem' }}>Enrollment</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.map(batch => {
                                const fillPercentage = ((batch.enrolled_count || 0) / batch.strength) * 100
                                const isFull = fillPercentage >= 100

                                return (
                                    <tr
                                        key={batch.id}
                                        onClick={() => navigate(`/dashboard/sales/batch/${batch.id}`)}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '1rem', fontWeight: '600' }}>{batch.id}</td>
                                        <td style={{ padding: '1rem' }}>{batch.name}</td>
                                        <td style={{ padding: '1rem' }}>{batch.course}</td>
                                        <td style={{ padding: '1rem' }}>
                                            {new Date(batch.start_date).toLocaleDateString('en-US', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${fillPercentage}%`,
                                                        height: '100%',
                                                        background: isFull ? '#ef4444' : 'var(--primary)',
                                                        transition: 'width 0.3s'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                                                    {batch.enrolled_count}/{batch.strength}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                background: isFull ? '#fee2e2' : '#dbeafe',
                                                color: isFull ? '#dc2626' : '#2563eb'
                                            }}>
                                                {isFull ? 'Full' : 'Open'}
                                            </span>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
