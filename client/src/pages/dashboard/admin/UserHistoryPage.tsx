import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { ArrowLeft, History as HistoryIcon, LogIn } from 'lucide-react'

interface ActivityLog {
    id: string
    action: string
    module?: string
    details: Record<string, any>
    ip_address: string
    user_agent: string
    created_at: string
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    })
}

export default function UserHistoryPage() {
    const params = useParams<{ id: string }>()
    const navigate = useNavigate()
    const id = params?.id as string
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await authedFetch(`/api/activity-logs?user_id=${encodeURIComponent(id)}`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to load history')
                setLogs((data.logs || []).map((l: any) => ({ ...l, id: l._id })))
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        if (id) load()
    }, [id])

    const logins = logs.filter(l => l.action === 'LOGIN')

    return (
        <div className="animate-fade-in">
            <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <ArrowLeft size={16} /> Back
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <HistoryIcon size={22} /> User Login & Activity History
            </h2>

            {loading ? (
                <div className="animate-pulse">Loading...</div>
            ) : error ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>{error}</div>
            ) : (
                <>
                    <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem' }}>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Logins</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{logins.length}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Last Login</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>{logins[0] ? formatDate(logins[0].created_at) : '—'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Total Actions Logged</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{logs.length}</div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        {logs.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No activity recorded for this user yet.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Time</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Module</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Action</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>IP Address</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Device</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{formatDate(log.created_at)}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{log.module || '—'}</td>
                                                <td style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                    {log.action === 'LOGIN' && <LogIn size={14} />} {log.action}
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{log.ip_address || '—'}</td>
                                                <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{log.user_agent === 'Unknown' ? '—' : (log.user_agent || '—').slice(0, 40)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
