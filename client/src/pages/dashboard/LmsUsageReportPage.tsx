import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import { Activity, Users, LogIn, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface UsageReport {
    totalVisits: number
    uniqueUsers: number
    totalLogins: number
    dateRange: { from: string; to: string } | null
    byRole: { role: string; count: number }[]
    topPages: { path: string; label: string; count: number }[]
    topUsers: { userName: string; role: string; count: number }[]
    dailyTrend: { date: string; count: number }[]
}

const formatRole = (role: string) => role.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ')

export default function LmsUsageReportPage() {
    const [report, setReport] = useState<UsageReport | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await authedFetch('/api/lms-usage/report')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setReport(data)
            } catch (err) {
                console.error('Error fetching LMS usage report:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) return <div className="animate-pulse">Loading usage report...</div>
    if (!report) return <div style={{ padding: '2rem', textAlign: 'center' }}>Could not load the LMS usage report.</div>

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={24} /> LMS Usage Report
            </h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
                Platform activity on the LMS/SHO app — page visits, active users and logins, read from its own usage logs.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        <Activity size={16} /> Total Page Visits
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.4rem' }}>{report.totalVisits.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        <Users size={16} /> Unique Active Users
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.4rem' }}>{report.uniqueUsers.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        <LogIn size={16} /> Total Logins
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.4rem' }}>{report.totalLogins.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>
                        <Calendar size={16} /> Tracked Since
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.4rem' }}>
                        {report.dateRange ? new Date(report.dateRange.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Daily Usage Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={report.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Page Visits" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Most Visited Pages</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <tbody>
                            {report.topPages.map((p, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0' }}>{p.label}</td>
                                    <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{p.count.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Most Active Users</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <tbody>
                            {report.topUsers.map((u, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0' }}>
                                        {u.userName}
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginLeft: '0.4rem' }}>{formatRole(u.role)}</span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{u.count.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="card">
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Usage by Role</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <tbody>
                            {report.byRole.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem 0' }}>{formatRole(r.role)}</td>
                                    <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 600 }}>{r.count.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
