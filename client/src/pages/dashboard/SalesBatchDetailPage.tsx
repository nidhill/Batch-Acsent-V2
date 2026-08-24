import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { ArrowLeft, Users, Mail, Phone, Trash2, CheckCircle, Edit, RefreshCw } from 'lucide-react'

interface Student {
    id: string
    student_email: string
    student_name: string
    student_phone: string
    linked_at: string
    sales_id?: string
    verified_at?: string
    status?: string
    sales_person?: {
        name: string
    }
}

interface Batch {
    id: string
    name: string
    course: string
    strength: number
    start_date: string
    school: string
    academic_lead: string
    sho_name: string
    mode: string
    cliq_id?: string
}

async function triggerVerificationWebhook(payload: any, type: 'verification' | 'update_email' = 'verification') {
    // Force Production URLs to ensure stability
    const baseUrl = 'https://purpletech.app.n8n.cloud/webhook/'

    let webhookId = ''
    if (type === 'verification') {
        webhookId = 'bcc93a8e-ce14-41e8-ad43-265a66a7ddd7'
    } else {
        webhookId = '956a4dff-4798-47ec-9da1-9d761fc3b156'
    }

    const webhookUrl = `${baseUrl}${webhookId}`

    console.log('Triggering webhook:', webhookUrl)

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`Webhook failed: ${res.status} ${text}`)
        }

        const data = await res.json()
        return { success: true, data }
    } catch (error: any) {
        console.error('Webhook error:', error)
        return { success: false, error: error.message }
    }
}

export default function SalesBatchDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [batch, setBatch] = useState<Batch | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [salesId, setSalesId] = useState<string | null>(null)
    const [editingStudent, setEditingStudent] = useState<Student | null>(null)
    const [newEmail, setNewEmail] = useState('')

    const handleRefreshCliqId = async () => {
        if (!batch?.sho_name) return

        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(batch.id)}/refresh-cliq-id`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setBatch(prev => prev ? { ...prev, cliq_id: data.cliq_id } : null)
            alert(`Cliq ID synced: ${data.cliq_id}`)
        } catch (error: any) {
            console.error('Error refreshing Cliq ID:', error)
            alert('Error: ' + error.message)
        }
    }

    const handleUpdateEmail = async () => {
        if (!editingStudent || !newEmail || !batch) return

        try {
            // 1. Update the admission record
            const patchRes = await authedFetch(`/api/admissions/${editingStudent.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_email: newEmail })
            })
            const patchData = await patchRes.json()
            if (!patchRes.ok) throw new Error(patchData.error)

            // 2. Trigger Webhook to resend email
            const payload = {
                action: 'verify_pl_single',
                sales_head: localStorage.getItem('userName'),
                student_name: editingStudent.student_name,
                student_email: newEmail,
                sales_id: editingStudent.sales_id,
                batch_id: batch.id,
                batch_name: batch.name,
                school: batch.school,
                timestamp: new Date().toISOString()
            }

            const webhookRes = await triggerVerificationWebhook(payload, 'update_email')
            if (!webhookRes.success) throw new Error(webhookRes.error)

            console.log('Webhook triggered successfully')

            // 3. Update Local State
            setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, student_email: newEmail } : s))
            setEditingStudent(null)
            setNewEmail('')
            alert('Email updated and verification email resent.')
        } catch (error: any) {
            console.error('Error updating email:', error)
            alert('Error updating email: ' + error.message)
        }
    }

    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        setSalesId(localStorage.getItem('salesId'))
        const role = localStorage.getItem('userRole')
        setUserRole(role)
        console.log('Sales View - User Role:', role)
        fetchBatchDetails()
        fetchStudents()
    }, [id])

    const fetchBatchDetails = async () => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id!)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBatch(data.batch)
        } catch (error) {
            console.error('Error fetching batch:', error)
        }
    }

    const handleDeleteStudent = async (studentId: string, email: string, name: string) => {
        if (!confirm(`Remove ${name} from this batch? This cannot be undone.`)) return

        try {
            const res = await authedFetch(`/api/admissions/${studentId}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            fetchStudents()
            alert('Student removed successfully')
        } catch (error: any) {
            console.error('Error deleting student:', error)
            alert('Error deleting student: ' + error.message)
        }
    }

    const fetchStudents = async () => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id!)}/students`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setStudents(data.students || [])
        } catch (error) {
            console.error('Error fetching students:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div>Loading...</div>

    if (!batch) return <div>Batch not found</div>

    // Filter students enrolled by this sales person. Real sales_id data has stray
    // whitespace/casing inconsistencies from years of manual entry — normalize both sides so
    // a rep's own students still match.
    const isMine = (s: { sales_id?: string }) =>
        !!s.sales_id && !!salesId && s.sales_id.trim().toUpperCase() === salesId.trim().toUpperCase()
    const myStudents = students.filter(isMine)
    const otherStudents = students.filter(s => !isMine(s))

    return (
        <div className="animate-fade-in">
            <button
                onClick={() => navigate(-1)}
                className="btn"
                style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <ArrowLeft size={18} />
                Back to Dashboard
            </button>

            {/* Batch Info Card */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{batch.name}</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Batch ID</p>
                        <p style={{ fontWeight: '600' }}>{batch.id}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cliq ID</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <p style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--primary)' }}>{batch.cliq_id || 'N/A'}</p>
                            {!batch.cliq_id && (
                                <button
                                    onClick={handleRefreshCliqId}
                                    title="Sync from SHO Profile"
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--primary)',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <RefreshCw size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Course</p>
                        <p style={{ fontWeight: '600' }}>{batch.course}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Start Date</p>
                        <p style={{ fontWeight: '600' }}>
                            {new Date(batch.start_date).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Mode</p>
                        <p style={{ fontWeight: '600' }}>{batch.mode}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Enrollment</p>
                        <p style={{ fontWeight: '600' }}>{students.length} / {batch.strength}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Academic Lead</p>
                        <p style={{ fontWeight: '600' }}>{batch.academic_lead}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>SHO</p>
                        <p style={{ fontWeight: '600' }}>{batch.sho_name}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>School</p>
                        <p style={{ fontWeight: '600' }}>{batch.school}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Your Enrollments</p>
                        <p style={{ fontWeight: '600', color: 'var(--primary)' }}>{myStudents.length}</p>
                    </div>
                </div>
            </div>

            {/* My Students */}
            {myStudents.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
                        Students You Enrolled ({myStudents.length})
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {myStudents.map(student => (
                            <div
                                key={student.id}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--surface)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: '1rem',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                    <h4 style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--primary)' }}>
                                        {student.student_name || 'N/A'}
                                    </h4>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        {student.student_email}
                                    </div>
                                    {student.student_phone && (
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {student.student_phone}
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        Enrolled: {new Date(student.linked_at).toLocaleDateString()}
                                    </div>
                                    {/* Show status only for SALES role AND if NOT verified */}
                                    {localStorage.getItem('userRole') !== 'SALES_HEAD' && !student.verified_at && student.status !== 'Verified' && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem', fontWeight: '500' }}>
                                            Status: Pending Team Lead Verification
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {/* Verified Status or Verify Button */}
                                    {(student.verified_at || student.status === 'Verified') ? (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'end',
                                            marginRight: '0.5rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    color: 'var(--success)',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600'
                                                }}>
                                                    <CheckCircle size={14} />
                                                    Verified & Sent Email
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingStudent(student)
                                                        setNewEmail(student.student_email)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--text-tertiary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Change Email"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            </div>
                                            {student.verified_at && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {new Date(student.verified_at).toLocaleDateString()} {new Date(student.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        ['SALES_HEAD', 'ADMIN'].includes(localStorage.getItem('userRole') || '') && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Verify student ${student.student_name}?`)) return

                                                    try {
                                                        const payload = {
                                                            action: 'verify_pl_single',
                                                            sales_head: localStorage.getItem('userName'),
                                                            student_name: student.student_name,
                                                            student_email: student.student_email,
                                                            sales_id: student.sales_id,
                                                            batch_id: batch.id,
                                                            batch_name: batch.name,
                                                            school: batch.school,
                                                            timestamp: new Date().toISOString()
                                                        }

                                                        const res = await triggerVerificationWebhook(payload, 'verification')
                                                        if (!res.success) throw new Error(res.error)

                                                        const data = res.data
                                                        if (data.Status === 'Verified') {
                                                            const verifyRes = await authedFetch(`/api/admissions/${student.id}/verify`, { method: 'POST' })
                                                            const verifyData = await verifyRes.json()

                                                            if (!verifyRes.ok) {
                                                                console.error('DB Update Error:', verifyData.error)
                                                                alert('Verification email sent, but database status update failed: ' + verifyData.error)
                                                            } else {
                                                                alert('Verified successfully!')
                                                                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, verified_at: verifyData.verified_at, status: 'Verified' } : s))
                                                            }
                                                        } else {
                                                            alert('Verification request sent.')
                                                        }
                                                    } catch (e) {
                                                        console.error(e)
                                                        alert('Error: Verification failed or timed out.')
                                                    }
                                                }}
                                                style={{
                                                    background: 'var(--success)',
                                                    border: 'none',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    padding: '0.5rem',
                                                    borderRadius: '0.375rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Verify Student"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        )
                                    )}

                                    {((!student.verified_at && student.status !== 'Verified') || ['SALES_HEAD', 'ACADEMIC_LEAD'].includes(userRole || '')) && (
                                        <button
                                            onClick={() => handleDeleteStudent(student.id, student.student_email, student.student_name)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: 'none',
                                                color: 'var(--error)',
                                                cursor: 'pointer',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.375rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                transition: 'background 0.2s'
                                            }}
                                            title={student.verified_at ? "Remove verified student (Sales Head only)" : "Remove student"}
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Other Students */}
            {otherStudents.length > 0 && (
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                        Other Students ({otherStudents.length})
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {otherStudents.map(student => (
                            <div
                                key={student.id}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--surface-hover)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <h4 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{student.student_name || 'N/A'}</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Mail size={14} />
                                            {student.student_email}
                                        </div>
                                        {(student.sales_id || student.sales_person) && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                                                Enrolled by: {student.sales_person?.name || student.sales_id}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            Enrolled: {new Date(student.linked_at).toLocaleDateString()}
                                        </span>
                                        {/* Show status only for SALES role AND if NOT verified */}
                                        {localStorage.getItem('userRole') !== 'SALES_HEAD' && !student.verified_at && student.status !== 'Verified' && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: '500' }}>
                                                Status: Pending Team Lead Verification
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {/* Verified Status or Verify Button */}
                                    {(student.verified_at || student.status === 'Verified') ? (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'end',
                                            marginRight: '0.5rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    color: 'var(--success)',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600'
                                                }}>
                                                    <CheckCircle size={14} />
                                                    Verified & Sent Email
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setEditingStudent(student)
                                                        setNewEmail(student.student_email)
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: 'var(--text-tertiary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Change Email"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                            </div>
                                            {student.verified_at && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {new Date(student.verified_at).toLocaleDateString()} {new Date(student.verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        ['SALES_HEAD', 'ADMIN'].includes(localStorage.getItem('userRole') || '') && (
                                            <button
                                                onClick={async () => {
                                                    if (!confirm(`Verify student ${student.student_name}?`)) return

                                                    try {
                                                        const payload = {
                                                            action: 'verify_pl_single',
                                                            sales_head: localStorage.getItem('userName'),
                                                            student_name: student.student_name,
                                                            student_email: student.student_email,
                                                            sales_id: student.sales_id,
                                                            batch_id: batch.id,
                                                            batch_name: batch.name,
                                                            school: batch.school,
                                                            timestamp: new Date().toISOString()
                                                        }

                                                        const res = await triggerVerificationWebhook(payload, 'verification')
                                                        if (!res.success) throw new Error(res.error)

                                                        const data = res.data
                                                        if (data.Status === 'Verified') {
                                                            const verifyRes = await authedFetch(`/api/admissions/${student.id}/verify`, { method: 'POST' })
                                                            const verifyData = await verifyRes.json()

                                                            if (!verifyRes.ok) {
                                                                console.error('DB Update Error:', verifyData.error)
                                                                alert('Verification email sent, but database status update failed: ' + verifyData.error)
                                                            } else {
                                                                alert('Verified successfully!')
                                                                setStudents(prev => prev.map(s => s.id === student.id ? { ...s, verified_at: verifyData.verified_at, status: 'Verified' } : s))
                                                            }
                                                        } else {
                                                            alert('Verification request sent.')
                                                        }
                                                    } catch (e) {
                                                        console.error(e)
                                                        alert('Error: Verification failed or timed out.')
                                                    }
                                                }}
                                                style={{
                                                    background: 'var(--success)',
                                                    border: 'none',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '0.375rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '600'
                                                }}
                                                title="Verify Student"
                                            >
                                                <CheckCircle size={16} />
                                                Verify
                                            </button>
                                        )
                                    )}
                                    {((!student.verified_at && student.status !== 'Verified') || ['SALES_HEAD', 'ACADEMIC_LEAD'].includes(userRole || '')) && (
                                        <button
                                            onClick={() => handleDeleteStudent(student.id, student.student_email, student.student_name)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: 'none',
                                                color: 'var(--error)',
                                                cursor: 'pointer',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '0.375rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                transition: 'background 0.2s',
                                                marginLeft: '0.5rem'
                                            }}
                                            title={student.verified_at ? "Remove verified student (Sales Head only)" : "Remove student"}
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {students.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-secondary)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>No students enrolled yet</p>
                </div>
            )}

            {/* Edit Email Modal */}
            {editingStudent && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 50
                }}>
                    <div style={{
                        background: 'var(--surface)',
                        padding: '1.5rem',
                        borderRadius: '0.5rem',
                        width: '100%',
                        maxWidth: '400px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Change Student Email</h3>
                        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Update email for {editingStudent.student_name}.
                        </p>
                        <input
                            type="email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Enter new email"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '0.375rem',
                                border: '1px solid var(--border)',
                                marginBottom: '1.5rem',
                                background: 'var(--background)'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setEditingStudent(null)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.375rem',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateEmail}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: '0.375rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                Update Email
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
