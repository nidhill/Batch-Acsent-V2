import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import { exportToCsv } from '@/lib/exportCsv'
import { exportToXlsx } from '@/lib/exportXlsx'
import { exportToPdf } from '@/lib/exportPdf'

interface ActivityLog {
    id: string
    user_id: string | null
    user_name: string
    user_email: string
    user_role: string
    action: string
    module?: string
    details: Record<string, any>
    ip_address: string
    user_agent: string
    created_at: string
}

// Pulls out any old_*/new_* (or *_before/*_after) pair from details for a dedicated
// "Change" column, instead of leaving it buried in the generic details blob.
function extractChange(details: Record<string, any>): { field: string; from: any; to: any } | null {
    if (!details) return null
    for (const key of Object.keys(details)) {
        if (key.startsWith('old_')) {
            const field = key.slice(4)
            const newKey = `new_${field}`
            if (newKey in details) return { field, from: details[key], to: details[newKey] }
        }
        if (key.startsWith('from_')) {
            const field = key.slice(5)
            const toKey = `to_${field}`
            if (toKey in details) return { field, from: details[key], to: details[toKey] }
        }
    }
    return null
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
    LOGIN: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    ROLE_CHANGE: { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
    USER_UPDATE: { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
    USER_INVITE: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' },
    USER_DELETE: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    STUDENT_ADDED: { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
    STUDENT_REMOVED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    STUDENT_TRANSFERRED: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
    STUDENT_VERIFIED: { bg: 'rgba(234,179,8,0.15)', color: '#ca8a04' },
    STUDENT_CALLED: { bg: 'rgba(59,130,246,0.15)', color: '#2563eb' },
    STUDENT_CALL_UNDO: { bg: 'rgba(156,163,175,0.15)', color: '#6b7280' },
    STUDENT_ONBOARDED: { bg: 'rgba(34,197,94,0.15)', color: '#16a34a' },
    STUDENT_ONBOARD_UNDO: { bg: 'rgba(156,163,175,0.15)', color: '#6b7280' },
    SHO_TRANSFERRED: { bg: 'rgba(245,158,11,0.15)', color: '#d97706' },
    BATCH_CREATED: { bg: 'rgba(16,185,129,0.15)', color: '#059669' },
    BATCH_UPDATED: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
    BATCH_DELETED: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
}

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    })
}

function formatDetails(details: Record<string, any>) {
    if (!details || typeof details !== 'object') return ''
    return Object.entries(details)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' · ')
}

function parseUserAgent(ua: string) {
    if (!ua || ua === 'Unknown') return '—'
    let browser = 'Browser'
    let os = 'Unknown OS'

    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
    else if (ua.includes('Firefox')) browser = 'Firefox'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
    else if (ua.includes('Edg')) browser = 'Edge'

    if (ua.includes('Android')) os = 'Android'
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
    else if (ua.includes('Windows NT 10')) os = 'Windows 10'
    else if (ua.includes('Windows NT 6')) os = 'Windows 7/8'
    else if (ua.includes('Mac OS X')) os = 'Mac'
    else if (ua.includes('Linux')) os = 'Linux'

    const mobile = ua.includes('Mobile') ? ' (Mobile)' : ''
    return `${browser} / ${os}${mobile}`
}

function ActionBadge({ action }: { action: string }) {
    const style = ACTION_COLORS[action] || { bg: 'rgba(107,114,128,0.15)', color: '#6b7280' }
    return (
        <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: style.bg,
            color: style.color,
            whiteSpace: 'nowrap'
        }}>
            {action}
        </span>
    )
}

const ACTION_OPTIONS = [
    'ALL',
    'LOGIN',
    'ROLE_CHANGE',
    'USER_UPDATE',
    'USER_INVITE',
    'USER_DELETE',
    'STUDENT_ADDED',
    'STUDENT_REMOVED',
    'STUDENT_TRANSFERRED',
    'STUDENT_VERIFIED',
    'STUDENT_CALLED',
    'STUDENT_CALL_UNDO',
    'STUDENT_ONBOARDED',
    'STUDENT_ONBOARD_UNDO',
    'SHO_TRANSFERRED',
    'BATCH_CREATED',
    'BATCH_UPDATED',
    'BATCH_DELETED',
]

export default function LogsPage() {
    const [logs, setLogs] = useState<ActivityLog[]>([])
    const [loading, setLoading] = useState(true)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [actionFilter, setActionFilter] = useState('ALL')
    const [moduleFilter, setModuleFilter] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchLogs = async () => {
        setLoading(true)
        setFetchError(null)
        try {
            const res = await authedFetch('/api/activity-logs')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to fetch logs')
            setLogs((data.logs || []).map((l: any) => ({ ...l, id: l._id })))
        } catch (err: any) {
            console.error('Failed to fetch logs:', err)
            setFetchError(err.message || 'Failed to fetch logs.')
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchLogs()
    }, [])

    const modules = Array.from(new Set(logs.map(l => l.module).filter(Boolean))) as string[]

    const filtered = logs.filter(log => {
        const matchesAction = actionFilter === 'ALL' || log.action === actionFilter
        const matchesModule = moduleFilter === 'ALL' || log.module === moduleFilter
        const q = searchQuery.toLowerCase()
        const matchesSearch =
            !q ||
            (log.user_name || '').toLowerCase().includes(q) ||
            (log.user_email || '').toLowerCase().includes(q)
        return matchesAction && matchesModule && matchesSearch
    })

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Activity Logs</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} found
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={() => exportToCsv('activity-logs', filtered.map(l => ({
                            time: l.created_at, user: l.user_name, email: l.user_email, role: l.user_role,
                            module: l.module, action: l.action, details: formatDetails(l.details), ip_address: l.ip_address, device: parseUserAgent(l.user_agent),
                        })))}
                        style={{ minWidth: '90px' }}
                    >
                        CSV
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => exportToXlsx('activity-logs', filtered.map(l => ({
                            time: l.created_at, user: l.user_name, email: l.user_email, role: l.user_role,
                            module: l.module, action: l.action, details: formatDetails(l.details), ip_address: l.ip_address, device: parseUserAgent(l.user_agent),
                        })))}
                        style={{ minWidth: '90px' }}
                    >
                        Excel
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => exportToPdf('activity-logs', filtered.map(l => ({
                            time: l.created_at, user: l.user_name, module: l.module, action: l.action, details: formatDetails(l.details), ip_address: l.ip_address,
                        })), 'Activity Logs')}
                        style={{ minWidth: '90px' }}
                    >
                        PDF
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={fetchLogs}
                        disabled={loading}
                        style={{ minWidth: '100px' }}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                    className="input"
                    value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    style={{ minWidth: '160px', flex: '0 0 auto' }}
                >
                    {ACTION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt === 'ALL' ? 'All Actions' : opt}</option>
                    ))}
                </select>
                <select
                    className="input"
                    value={moduleFilter}
                    onChange={e => setModuleFilter(e.target.value)}
                    style={{ minWidth: '160px', flex: '0 0 auto' }}
                >
                    <option value="ALL">All Modules</option>
                    {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                    className="input"
                    type="text"
                    placeholder="Search by user name or email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: '1', minWidth: '200px' }}
                />
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading activity logs...
                    </div>
                ) : fetchError ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--error)' }}>
                        ⚠️ {fetchError}
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No activity logs found.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>#</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Time</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>User</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Role</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Module</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Action</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Change</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Details</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>IP Address</th>
                                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Device</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((log, idx) => (
                                    <tr
                                        key={log.id}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                                    >
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: 600 }}>{log.user_name || '—'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.user_email || ''}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                            {log.user_role || '—'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {log.module || '—'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <ActionBadge action={log.action} />
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                                            {(() => {
                                                const change = extractChange(log.details)
                                                if (!change) return '—'
                                                return <span><span style={{ color: '#dc2626' }}>{String(change.from ?? '∅')}</span> → <span style={{ color: '#16a34a' }}>{String(change.to ?? '∅')}</span></span>
                                            })()}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', maxWidth: '260px', fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatDetails(log.details)}>
                                            {formatDetails(log.details)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {log.ip_address || '—'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }} title={log.user_agent}>
                                            {parseUserAgent(log.user_agent)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
