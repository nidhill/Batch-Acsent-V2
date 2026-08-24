import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, IndianRupee, Activity, Paperclip } from 'lucide-react'

const badge = (bg: string, color: string) => ({
    padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
    background: bg, color, display: 'inline-flex', alignItems: 'center' as const,
})

export default function StudentDetailPage() {
    const params = useParams<{ id: string }>()
    const navigate = useNavigate()
    const id = params?.id as string
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [documents, setDocuments] = useState<Record<string, any>>({})

    useEffect(() => {
        const load = async () => {
            try {
                const res = await authedFetch(`/api/admissions/${id}`)
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Failed to load student')
                setData(json)

                const docRes = await authedFetch(`/api/admissions/${id}/documents`)
                const docJson = await docRes.json()
                if (docRes.ok) setDocuments(docJson.documents || {})
            } catch (err: any) {
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }
        if (id) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    if (loading) return <div className="animate-pulse">Loading student profile...</div>
    if (error) return <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>{error}</div>
    if (!data) return null

    const { admission: a, batch, payment, payment_clearance_status, transactions, activity, lms_access_granted } = data

    const clearanceColors: Record<string, { bg: string; color: string }> = {
        Cleared: { bg: 'var(--success-light)', color: 'var(--success)' },
        Pending: { bg: 'var(--warning-light)', color: 'var(--warning)' },
        Restricted: { bg: 'var(--secondary-light)', color: 'var(--text-secondary)' },
    }
    const cc = clearanceColors[payment_clearance_status] || clearanceColors.Restricted

    return (
        <div className="animate-fade-in">
            <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <ArrowLeft size={16} /> Back
            </button>

            {/* Header */}
            <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
                        {a.student_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{a.student_name}</h2>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{a.official_student_id || 'No official ID yet'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={badge(a.status === 'Verified' ? 'var(--success-light)' : a.status === 'Rejected' ? 'var(--error-light)' : 'var(--warning-light)', a.status === 'Verified' ? 'var(--success)' : a.status === 'Rejected' ? 'var(--error)' : 'var(--warning)')}>
                        {a.status || 'Pending'}
                    </span>
                    <span style={badge(cc.bg, cc.color)}>Payment: {payment_clearance_status}</span>
                    {a.onboarding_completed && <span style={badge('var(--info-light)', 'var(--info)')}>Onboarded</span>}
                    <span style={badge(lms_access_granted ? 'var(--success-light)' : 'var(--error-light)', lms_access_granted ? 'var(--success)' : 'var(--error)')}>
                        LMS Access: {lms_access_granted ? 'Granted' : 'Restricted'}
                    </span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Personal Details */}
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={18} /> Personal Details
                    </h3>
                    <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} color="var(--text-secondary)" /> {a.student_email}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} color="var(--text-secondary)" /> {a.student_phone || '—'} {a.whatsapp_number ? `(WhatsApp: ${a.whatsapp_number})` : ''}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={14} color="var(--text-secondary)" /> {[a.address, a.city, a.state, a.region].filter(Boolean).join(', ') || '—'}</div>
                        <div>Age: {a.age ?? '—'} {a.gender ? `· ${a.gender}` : ''}</div>
                        {(a.guardian_name || a.guardian_contact) && (
                            <div>Guardian: {a.guardian_name || '—'} {a.guardian_contact ? `(${a.guardian_contact})` : ''}</div>
                        )}
                    </div>
                </div>

                {/* Admission Details */}
                <div className="card">
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} /> Admission Details
                    </h3>
                    <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
                        <div>Batch: <strong>{batch?.name || a.batch_id}</strong></div>
                        <div>School: {batch?.school || '—'}</div>
                        <div>Lead Source: {a.lead_source || '—'}</div>
                        <div>Lead Created: {a.lead_creation_date || '—'}</div>
                        <div>Admission Date: {a.admission_date || '—'}</div>
                        <div>Action Type: {a.action_type || '—'}</div>
                        <div>Sales ID: {a.sales_id || '—'}</div>
                    </div>
                </div>

                {/* Payment Summary */}
                {payment && (
                    <div className="card">
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <IndianRupee size={18} /> Payment Summary
                        </h3>
                        <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.9rem' }}>
                            <div>Course Fee: ₹{(payment.course_fee || 0).toLocaleString()}</div>
                            <div>Discount: ₹{(payment.discount || 0).toLocaleString()} · Scholarship: ₹{(payment.scholarship || 0).toLocaleString()}</div>
                            <div>Final Fee: <strong>₹{(payment.final_fee || 0).toLocaleString()}</strong></div>
                            <div style={{ color: 'var(--success)' }}>Paid: ₹{(payment.amount_paid || 0).toLocaleString()}</div>
                            <div style={{ color: 'var(--warning)' }}>Remaining: ₹{(payment.remaining_amount || 0).toLocaleString()}</div>
                            <div>Status: {payment.payment_status}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Documents */}
            {Object.keys(documents).length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Paperclip size={18} /> Documents
                    </h3>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {Object.entries(documents).map(([type, doc]: [string, any]) => (
                            <a key={type} href={doc.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                {type.replace(/_/g, ' ')}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Transactions */}
            {transactions?.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem' }}>Payment Transactions</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Amount</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Method</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Channel</th>
                                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Receipt #</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t: any) => (
                                    <tr key={t._id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.6rem' }}>{t.paid_at ? new Date(t.paid_at).toLocaleDateString() : '—'}</td>
                                        <td style={{ padding: '0.6rem' }}>₹{(t.amount || 0).toLocaleString()}</td>
                                        <td style={{ padding: '0.6rem' }}>{t.method || '—'}</td>
                                        <td style={{ padding: '0.6rem' }}>{t.channel || '—'}</td>
                                        <td style={{ padding: '0.6rem' }}>{t.receipt_number || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Activity Timeline */}
            <div className="card">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={18} /> Activity Timeline
                </h3>
                {(!activity || activity.length === 0) ? (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No activity recorded yet.</div>
                ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {activity.map((log: any) => (
                            <div key={log._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                <div>
                                    <strong>{log.action}</strong> by {log.userName || log.userEmail || 'system'} ({log.userRole})
                                </div>
                                <div style={{ color: 'var(--text-secondary)' }}>{log.created_at ? new Date(log.created_at).toLocaleString() : ''}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
