import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { ArrowLeft, Users, Mail, Phone, Calendar, RefreshCw, CheckCircle, User, Trash2, Edit, UserPlus, X, ArrowRightLeft, MoveRight } from 'lucide-react'

interface Student {
    id: string
    student_email: string
    student_name: string
    student_phone: string
    linked_at: string
    sales_id?: string
    sales_person?: {
        name: string
        phone: string
        sales_id?: string
    }
    onboarding_completed?: boolean
    official_student_id?: string
    verified_at?: string
    status?: string
    called_at?: string
    payment_clearance_status?: 'Cleared' | 'Pending' | 'Restricted'
    learner_agreement_status?: 'not_sent' | 'sent' | 'opened' | 'signed'
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

export default function BatchDetailPage() {
    const params = useParams<{ id: string }>()
    const id = params.id!
    const navigate = useNavigate()
    const [batch, setBatch] = useState<Batch | null>(null)
    const [students, setStudents] = useState<Student[]>([])
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [userSchool, setUserSchool] = useState<string | null>(null)
    const [userSalesId, setUserSalesId] = useState<string | null>(null)

    const [editingStudentId, setEditingStudentId] = useState<string | null>(null)
    const [tempEmail, setTempEmail] = useState('')

    const [showAddModal, setShowAddModal] = useState(false)
    const [addLoading, setAddLoading] = useState(false)
    const [salesPersons, setSalesPersons] = useState<{ id: string; name: string; sales_id: string; school: string }[]>([])
    const [addForm, setAddForm] = useState({ student_name: '', student_email: '', student_phone: '', sales_user_id: '' })

    const [showTransferModal, setShowTransferModal] = useState(false)
    const [transferLoading, setTransferLoading] = useState(false)
    const [shos, setShos] = useState<{ id: string; name: string; school: string }[]>([])
    const [selectedSho, setSelectedSho] = useState('')

    const [showStudentTransferModal, setShowStudentTransferModal] = useState(false)
    const [studentTransferLoading, setStudentTransferLoading] = useState(false)
    const [transferringStudent, setTransferringStudent] = useState<Student | null>(null)
    const [allBatches, setAllBatches] = useState<{ id: string; name: string; course: string; school: string }[]>([])
    const [selectedTransferBatch, setSelectedTransferBatch] = useState('')

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserRole(localStorage.getItem('userRole'))
            setUserSchool(localStorage.getItem('userSchool'))
            setUserSalesId(localStorage.getItem('salesId'))
        }


        console.log('User Role:', userRole) // Note: userRole state might not be updated immediately in this effect cycle unless we add it to dep, but we are inside the effect where we just set it from storage? No, setState is async.
        // Better to rely on the console log inside the if block or just log from storage.

        // Ensure ID is fully decoded (e.g. if URL has %2F it might be double encoded or just encoded once)
        const dbId = decodeURIComponent(id)
        console.log('Fetching batch details for ID (raw):', id)
        console.log('Fetching batch details for ID (decoded):', dbId)

        fetchBatchDetails(dbId)
        fetchStudents(dbId)
        fetchSalesPersons()
        fetchAllBatches()
    }, [id])

    const fetchAllBatches = async () => {
        try {
            const res = await authedFetch('/api/batches?view=all')
            const data = await res.json()
            if (data.batches) setAllBatches(data.batches)
        } catch (err) {
            console.error('Error fetching batches:', err)
        }
    }

    const handleStudentTransfer = async () => {
        if (!selectedTransferBatch || !transferringStudent) { alert('Please select a batch'); return }
        setStudentTransferLoading(true)
        try {
            // Transfers now go through Academic Lead approval (SRS Doc 4 §9) rather than
            // moving instantly — this creates a pending request instead.
            const res = await authedFetch('/api/batch-transfer-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admission_id: transferringStudent.id, to_batch_id: selectedTransferBatch })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to request transfer')

            setShowStudentTransferModal(false)
            setTransferringStudent(null)
            setSelectedTransferBatch('')
            alert(`Transfer request submitted for ${transferringStudent.student_name} — pending Academic Lead approval.`)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setStudentTransferLoading(false)
        }
    }

    const fetchSalesPersons = async () => {
        const res = await authedFetch('/api/users?directory=1&role=SALES')
        const data = await res.json()
        if (data.users) setSalesPersons(data.users.map((u: any) => ({ ...u, id: u._id })))
    }

    const fetchShos = async (school: string) => {
        const res = await authedFetch(`/api/users?directory=1&role=SHO,SSHO&school=${encodeURIComponent(school)}`)
        const data = await res.json()
        if (data.users) setShos(data.users.map((u: any) => ({ ...u, id: u._id })))
    }

    const handleTransferSho = async () => {
        if (!selectedSho) { alert('Please select a SHO'); return }
        const sho = shos.find(s => s.id === selectedSho)
        if (!sho) return
        setTransferLoading(true)
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}/transfer-sho`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sho_user_id: selectedSho })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to transfer SHO')

            setBatch(prev => prev ? { ...prev, sho_name: sho.name } : null)
            setShowTransferModal(false)
            setSelectedSho('')
            alert(`Batch transferred to ${sho.name} successfully!`)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setTransferLoading(false)
        }
    }

    const handleAddStudent = async () => {
        if (!addForm.student_name || !addForm.student_email || !addForm.student_phone || !addForm.sales_user_id) {
            alert('Please fill all fields')
            return
        }
        setAddLoading(true)
        try {
            const res = await authedFetch('/api/link-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...addForm, batch_id: id })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to add student')

            setShowAddModal(false)
            setAddForm({ student_name: '', student_email: '', student_phone: '', sales_user_id: '' })
            fetchStudents(id)
            alert('Student added successfully!')
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setAddLoading(false)
        }
    }

    // ... (fetchBatchDetails, fetchStudents)

    const fetchBatchDetails = async (batchId = id) => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(batchId)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBatch(data.batch)
        } catch (error) {
            console.error('Error fetching batch:', error)
        }
    }

    const fetchStudents = async (batchId = id) => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(batchId)}/students`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setStudents(data.students || [])
        } catch (error) {
            console.error('Error fetching students:', error)
        } finally {
            setLoading(false)
        }
    }

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


    const handleVerifyStudent = async (studentId: string) => {
        if (!confirm('Are you sure you want to verify this student?')) return

        try {
            const res = await authedFetch(`/api/admissions/${studentId}/verify`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, verified_at: data.verified_at, status: 'Verified' } : s))
        } catch (error: any) {
            console.error('Error verifying student:', error)
            alert('Error verifying student: ' + error.message)
        }
    }

    const toggleOnboarding = async (student: Student, currentStatus: boolean) => {
        try {
            const res = await authedFetch(`/api/admissions/${student.id}/onboard`, { method: 'POST' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            fetchStudents()
        } catch (error: any) {
            console.error('Error updating status:', error)
            alert('Failed to update status: ' + error.message)
        }
    }

    const handleDeleteStudent = async (studentId: string, email: string) => {
        if (!confirm('Are you sure you want to remove this student? This action cannot be undone.')) return

        try {
            const res = await authedFetch(`/api/admissions/${studentId}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setStudents(prev => prev.filter(s => s.id !== studentId))
            alert('Student removed successfully')
        } catch (error: any) {
            console.error('Error deleting student:', error)
            alert('Error deleting student: ' + error.message)
        }
    }

    const handleCallStudent = async (studentId: string, phone: string, undo: boolean = false) => {
        try {
            if (undo && !confirm('Are you sure you want to undo the call status?')) return

            const res = await authedFetch(`/api/admissions/${studentId}/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ undo })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, called_at: data.called_at } : s))

            // Open Dialer AFTER saving
            if (!undo) {
                window.location.href = `tel:${phone}`
            }
        } catch (error: any) {
            console.error('Error updating call status:', error)
            alert('Error updating call status: ' + error.message)
        }
    }

    const startEditingEmail = (student: Student) => {
        setEditingStudentId(student.id)
        setTempEmail(student.student_email)
    }

    const cancelEditingEmail = () => {
        setEditingStudentId(null)
        setTempEmail('')
    }

    const saveEmail = async (student: Student) => {
        if (!tempEmail || !tempEmail.includes('@')) {
            alert('Please enter a valid email')
            return
        }
        if (tempEmail === student.student_email) {
            cancelEditingEmail()
            return
        }

        try {
            const res = await authedFetch(`/api/admissions/${student.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ student_email: tempEmail })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Update local state
            setStudents(prev => prev.map(s => s.id === student.id ? { ...s, student_email: tempEmail } : s))
            setEditingStudentId(null)
            setTempEmail('')
            alert('Email updated successfully')

        } catch (error: any) {
            console.error('Error updating email:', error)
            alert('Failed to update email: ' + error.message)
        }
    }

    const canEditEmail = (student: Student) => {
        if (!userRole) return false

        // Admins/CEO
        if (['ADMIN', 'CEO'].includes(userRole)) return true

        // Sales Head (School Match)
        if (['SALES_HEAD'].includes(userRole)) {
            return batch?.school === userSchool
        }

        // Sales Person (Own Student). Real sales_id data has stray whitespace/casing
        // inconsistencies from years of manual entry — normalize both sides so a rep's own
        // students still match.
        if (userRole === 'SALES') {
            return !!student.sales_person?.sales_id && !!userSalesId &&
                student.sales_person.sales_id.trim().toUpperCase() === userSalesId.trim().toUpperCase()
        }

        return false
    }

    if (loading) return <div>Loading...</div>

    if (!batch) return <div>Batch not found</div>

    // Helper to check if user can verify (Sales Head, SHO, SSHO within their school)
    const canVerify = (
        ['ADMIN', 'CEO'].includes(userRole || '') ||
        (
            ['SALES_HEAD'].includes(userRole || '') &&
            (userSchool === batch.school)
        )
    )

    const canDelete = (
        ['ADMIN', 'CEO', 'ACADEMIC_LEAD', 'SALES_HEAD'].includes(userRole || '')
    )



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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{batch.name}</h2>
                    {['ADMIN', 'CEO', 'ACADEMIC_LEAD'].includes(userRole || '') && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => { fetchShos(batch.school); setShowTransferModal(true) }}
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}
                                title="Transfer to another SHO"
                            >
                                <ArrowRightLeft size={15} /> Transfer SHO
                            </button>
                            <button
                                onClick={() => navigate(`/dashboard/batch/${id}/edit`)}
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.375rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem' }}
                                title="Edit Batch"
                            >
                                <Edit size={15} /> Edit Batch
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Batch ID</p>
                        <p style={{ fontWeight: '600' }}>{batch.id}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Cliq ID</p>
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
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Course</p>
                        <p style={{ fontWeight: '600' }}>{batch.course}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Start Date</p>
                        <p style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} />
                            {new Date(batch.start_date).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                            })}
                        </p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Mode</p>
                        <p style={{ fontWeight: '600' }}>{batch.mode}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Enrollment</p>
                        <p style={{ fontWeight: '600', color: 'var(--primary)' }}>{students.length} / {batch.strength}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Academic Lead</p>
                        <p style={{ fontWeight: '600' }}>{batch.academic_lead}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>SHO</p>
                        <p style={{ fontWeight: '600' }}>{batch.sho_name}</p>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>School</p>
                        <p style={{ fontWeight: '600' }}>{batch.school}</p>
                    </div>
                </div>
            </div>

            {/* Transfer SHO Modal */}
            {showTransferModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
                        <button onClick={() => { setShowTransferModal(false); setSelectedSho('') }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <X size={20} />
                        </button>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ArrowRightLeft size={20} /> Transfer Batch SHO
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Current SHO: <strong>{batch.sho_name || 'None'}</strong>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label">Select New SHO ({batch.school})</label>
                                <select className="input" value={selectedSho} onChange={e => setSelectedSho(e.target.value)}>
                                    <option value="">Choose SHO / SSHO...</option>
                                    {shos.filter(s => s.name !== batch.sho_name).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                {shos.filter(s => s.name !== batch.sho_name).length === 0 && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No other SHOs available for {batch.school}.</p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowTransferModal(false); setSelectedSho('') }}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleTransferSho} disabled={transferLoading || !selectedSho}>
                                    {transferLoading ? 'Transferring...' : 'Confirm Transfer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Student Transfer Modal */}
            {showStudentTransferModal && transferringStudent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '440px', position: 'relative' }}>
                        <button onClick={() => { setShowStudentTransferModal(false); setTransferringStudent(null); setSelectedTransferBatch('') }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <X size={20} />
                        </button>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <MoveRight size={20} /> Transfer Student
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Moving <strong>{transferringStudent.student_name}</strong> from <strong>{batch.name}</strong>
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label">Select Destination Batch</label>
                                <select className="input" value={selectedTransferBatch} onChange={e => setSelectedTransferBatch(e.target.value)}>
                                    <option value="">Choose batch...</option>
                                    {allBatches.filter(b => b.id !== id).map(b => (
                                        <option key={b.id} value={b.id}>[{b.id}] {b.name} — {b.course} ({b.school})</option>
                                    ))}
                                </select>
                            </div>
                            {transferringStudent.onboarding_completed && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--warning)', background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: '0.375rem', padding: '0.5rem 0.75rem' }}>
                                    This student is onboarded — their official record will also be moved to the new batch.
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowStudentTransferModal(false); setTransferringStudent(null); setSelectedTransferBatch('') }}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleStudentTransfer} disabled={studentTransferLoading || !selectedTransferBatch}>
                                    {studentTransferLoading ? 'Transferring...' : 'Confirm Transfer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Student Modal */}
            {showAddModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
                        <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <X size={20} />
                        </button>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <UserPlus size={20} /> Add Student to {batch?.name}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="label">Full Name</label>
                                <input className="input" placeholder="e.g. John Doe" value={addForm.student_name} onChange={e => setAddForm({ ...addForm, student_name: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Email Address</label>
                                <input className="input" type="email" placeholder="student@example.com" value={addForm.student_email} onChange={e => setAddForm({ ...addForm, student_email: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Phone Number</label>
                                <input className="input" type="tel" placeholder="+91 XXXXX XXXXX" value={addForm.student_phone} onChange={e => setAddForm({ ...addForm, student_phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="label">Sales Person</label>
                                <select className="input" value={addForm.sales_user_id} onChange={e => setAddForm({ ...addForm, sales_user_id: e.target.value })}>
                                    <option value="">Select sales person...</option>
                                    {salesPersons.filter(s => !batch?.school || !s.school || s.school === batch.school).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} {s.sales_id ? `(${s.sales_id})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddStudent} disabled={addLoading}>
                                    {addLoading ? 'Adding...' : 'Add Student'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Students List */}
            <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Users size={20} />
                        Enrolled Students ({students.length})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {['ADMIN', 'CEO', 'ACADEMIC_LEAD', 'SALES_HEAD'].includes(userRole || '') && (
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="btn btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                            >
                                <UserPlus size={16} /> Add Student
                            </button>
                        )}
                        <button
                            onClick={() => fetchStudents(id)}
                            title="Refresh List"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </h3>

                {students.length > 0 ? (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {students.map(student => (
                            <div
                                key={student.id}
                                style={{
                                    background: 'var(--surface)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderLeft: `5px solid ${!(student.verified_at || student.status === 'Verified') ? 'var(--warning)' /* Orange */
                                        : student.onboarding_completed ? 'var(--success)' /* Green */
                                            : 'var(--warning)' /* Yellow */
                                        }`,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '1rem',
                                    gap: '1rem',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                            >
                                {/* 1. Avatar */}
                                <div style={{
                                    flexShrink: 0, width: '3rem', height: '3rem', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--primary), #60a5fa)',
                                    color: 'white', fontWeight: 'bold', fontSize: '1.2rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 4px 6px -1px rgba(var(--primary-rgb), 0.3)'
                                }}>
                                    {student.student_name?.[0]?.toUpperCase() || '?'}
                                </div>

                                {/* 2. Identity */}
                                <div style={{ flex: '1' }}>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--foreground)', lineHeight: '1.2' }}>
                                        {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') ? (
                                            <a href={`/dashboard/student/${student.id}`} style={{ color: 'inherit', textDecoration: 'none' }} title="View Student 360° Profile">
                                                {student.student_name || 'N/A'}
                                            </a>
                                        ) : (student.student_name || 'N/A')}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.125rem', marginTop: '0.25rem' }}>

                                        {/* EMAIL FIELD WITH EDIT */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minHeight: '1.5rem' }}>
                                            <Mail size={12} strokeWidth={2} />
                                            {editingStudentId === student.id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <input
                                                        type="email"
                                                        value={tempEmail}
                                                        onChange={(e) => setTempEmail(e.target.value)}
                                                        style={{
                                                            fontSize: '0.85rem', padding: '0.1rem 0.25rem',
                                                            border: '1px solid var(--primary)', borderRadius: '0.25rem',
                                                            width: '200px'
                                                        }}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => saveEmail(student)} style={{ color: 'var(--green-600)', background: 'none', border: 'none', cursor: 'pointer' }} title="Save">
                                                        <CheckCircle size={14} />
                                                    </button>
                                                    <button onClick={cancelEditingEmail} style={{ color: 'var(--red-600)', background: 'none', border: 'none', cursor: 'pointer' }} title="Cancel">
                                                        <CheckCircle size={14} style={{ transform: 'rotate(45deg)' }} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {student.student_email}
                                                    {canEditEmail(student) && (
                                                        <button
                                                            onClick={() => startEditingEmail(student)}
                                                            style={{
                                                                opacity: 0,
                                                                transition: 'opacity 0.2s',
                                                                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)'
                                                            }}
                                                            className="group-hover:opacity-100"
                                                            title="Edit Email"
                                                        >
                                                            <RefreshCw size={12} style={{ transform: 'rotate(90deg)' }} />
                                                        </button>
                                                    )}
                                                </span>
                                            )}
                                        </div>

                                        {student.student_phone && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                                <Phone size={12} strokeWidth={2} /> {student.student_phone}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 3. Meta (Middle) */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', paddingRight: '1rem' }}>
                                    {student.official_student_id && (
                                        <span style={{
                                            fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: '700',
                                            background: 'var(--info-light)', color: 'var(--info)',
                                            padding: '0.125rem 0.6rem', borderRadius: '0.375rem',
                                            border: '1px solid var(--info-light)'
                                        }}>
                                            {student.official_student_id}
                                        </span>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        Enrolled {new Date(student.linked_at).toLocaleDateString('en-GB')}
                                    </div>
                                    {student.sales_person && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            By <span style={{ fontWeight: '600' }}>{student.sales_person.name}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '999px',
                                            background: student.payment_clearance_status === 'Cleared' ? 'var(--success-light)' : student.payment_clearance_status === 'Pending' ? 'var(--warning-light)' : 'var(--secondary-light)',
                                            color: student.payment_clearance_status === 'Cleared' ? 'var(--success)' : student.payment_clearance_status === 'Pending' ? 'var(--warning)' : 'var(--text-secondary)',
                                        }}>
                                            Payment: {student.payment_clearance_status}
                                        </span>
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '999px',
                                            background: student.learner_agreement_status === 'signed' ? 'var(--success-light)' : student.learner_agreement_status === 'not_sent' ? 'var(--secondary-light)' : 'var(--info-light)',
                                            color: student.learner_agreement_status === 'signed' ? 'var(--success)' : student.learner_agreement_status === 'not_sent' ? 'var(--text-secondary)' : 'var(--info)',
                                        }}>
                                            Agreement: {(student.learner_agreement_status || 'not_sent').replace('_', ' ')}
                                        </span>
                                        {['ACADEMIC_LEAD', 'ADMIN', 'CEO'].includes(userRole || '') && student.learner_agreement_status === 'not_sent' && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await authedFetch('/api/learner-agreements', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ admission_id: student.id })
                                                        })
                                                        const data = await res.json()
                                                        if (!res.ok) throw new Error(data.error)
                                                        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, learner_agreement_status: 'sent' } : s))
                                                    } catch (err: any) {
                                                        alert('Error: ' + err.message)
                                                    }
                                                }}
                                                style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                                            >
                                                Send Agreement
                                            </button>
                                        )}
                                        {['ACADEMIC_LEAD', 'ADMIN', 'CEO'].includes(userRole || '') && ['sent', 'opened'].includes(student.learner_agreement_status || '') && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const res = await authedFetch(`/api/learner-agreements/${student.id}/remind`, { method: 'POST' })
                                                        const data = await res.json()
                                                        if (!res.ok) throw new Error(data.error)
                                                        alert('Reminder sent to ' + student.student_name)
                                                    } catch (err: any) {
                                                        alert('Error: ' + err.message)
                                                    }
                                                }}
                                                style={{ fontSize: '0.7rem', color: 'var(--warning)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                                            >
                                                Send Reminder
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Vertical Divider */}
                                <div style={{ width: '1px', alignSelf: 'stretch', background: 'var(--border)', margin: '0.5rem 0' }} />

                                {/* 4. Status & Actions (Right) - UPDATED WORKFLOW */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', minWidth: '140px' }}>

                                    {/* Verification Check */}
                                    {!(student.verified_at || student.status === 'Verified') ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                padding: '0.25rem 0.75rem', borderRadius: '9999px',
                                                fontSize: '0.75rem', fontWeight: '600',
                                                background: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)',
                                                display: 'flex', alignItems: 'center', gap: '0.375rem'
                                            }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warning)' }} />
                                                Pending Verification
                                            </div>

                                            {canVerify && (
                                                <button
                                                    onClick={() => handleVerifyStudent(student.id)}
                                                    className="hover:scale-105 active:scale-95"
                                                    style={{
                                                        fontSize: '0.75rem', fontWeight: '600',
                                                        color: 'white', background: 'var(--warning)',
                                                        border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                                                        boxShadow: '0 2px 4px rgba(249, 115, 22, 0.2)',
                                                        transition: 'transform 0.1s'
                                                    }}
                                                >
                                                    <CheckCircle size={12} /> Verify Now
                                                </button>
                                            )}

                                            {canDelete && (
                                                <div style={{ display: 'flex', gap: '0.375rem', marginLeft: '0.5rem' }}>
                                                    <button
                                                        onClick={() => { setTransferringStudent(student); setShowStudentTransferModal(true) }}
                                                        style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', background: 'transparent', border: '1px solid var(--primary)', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                        title="Transfer to another batch"
                                                    >
                                                        <MoveRight size={12} /> Transfer
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStudent(student.id, student.student_email)}
                                                        style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--error)', background: 'transparent', border: '1px solid var(--error-border)', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                        title="Remove Student"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            {/* Workflow: Verified -> To Call -> Pending Onboard -> Onboarded */}

                                            {/* 1. NOT CALLED YET */}
                                            {!student.called_at ? (
                                                <>
                                                    <div style={{
                                                        padding: '0.25rem 0.75rem', borderRadius: '9999px',
                                                        fontSize: '0.75rem', fontWeight: '600',
                                                        background: 'var(--info-light)', color: 'var(--info)', border: '1px solid var(--info)',
                                                        display: 'flex', alignItems: 'center', gap: '0.375rem'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--info)' }} />
                                                        To Call
                                                    </div>

                                                    {['ADMIN', 'CEO', 'ACADEMIC_LEAD', 'SALES_HEAD'].includes(userRole || '') && (
                                                        <button
                                                            onClick={() => handleCallStudent(student.id, student.student_phone)}
                                                            className="hover:scale-105 active:scale-95"
                                                            style={{
                                                                fontSize: '0.75rem', fontWeight: '600',
                                                                color: 'white', background: 'var(--primary)',
                                                                border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                                                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                                                                boxShadow: '0 2px 4px rgba(var(--primary-rgb), 0.2)',
                                                                transition: 'transform 0.1s'
                                                            }}
                                                        >
                                                            <Phone size={12} /> Call Student
                                                        </button>
                                                    )}

                                                    {canDelete && (
                                                        <div style={{ display: 'flex', gap: '0.375rem', marginLeft: '0.5rem' }}>
                                                            <button
                                                                onClick={() => { setTransferringStudent(student); setShowStudentTransferModal(true) }}
                                                                style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', background: 'transparent', border: '1px solid var(--primary)', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                                title="Transfer to another batch"
                                                            >
                                                                <MoveRight size={12} /> Transfer
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteStudent(student.id, student.student_email)}
                                                                style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--error)', background: 'transparent', border: '1px solid var(--error-border)', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                                title="Remove Student"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                /* 2. CALLED, EITHER PENDING OR ONBOARDED */
                                                <>
                                                    {/* Badge */}
                                                    <div style={{
                                                        padding: '0.25rem 0.75rem', borderRadius: '9999px',
                                                        fontSize: '0.75rem', fontWeight: '600',
                                                        background: student.onboarding_completed ? 'var(--success-light)' : 'var(--warning-light)',
                                                        color: student.onboarding_completed ? 'var(--success)' : 'var(--warning)',
                                                        border: `1px solid ${student.onboarding_completed ? 'var(--success)' : 'var(--warning)'}`,
                                                        display: 'flex', alignItems: 'center', gap: '0.375rem'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: student.onboarding_completed ? 'var(--success)' : 'var(--warning)' }} />
                                                        {student.onboarding_completed ? 'Onboarded' : 'Pending Onboard'}
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                                        {/* Called Date */}
                                                        <div style={{
                                                            fontSize: '0.7rem', color: 'var(--text-secondary)',
                                                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                                                            background: 'var(--surface-active)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem'
                                                        }}>
                                                            <Phone size={12} />
                                                            Called {new Date(student.called_at).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </div>

                                                        {/* Action: Mark Done or Undo */}
                                                        {['ADMIN', 'CEO', 'ACADEMIC_LEAD', 'SALES_HEAD'].includes(userRole || '') && (
                                                            <button
                                                                onClick={() => handleCallStudent(student.id, '', true)}
                                                                style={{
                                                                    fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                                    textDecoration: 'underline', marginTop: '0.125rem', marginBottom: '0.25rem'
                                                                }}
                                                            >
                                                                Accidentally clicked? Undo Call
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => toggleOnboarding(student, !!student.onboarding_completed)}
                                                            style={{
                                                                fontSize: '0.75rem', fontWeight: '500',
                                                                color: 'var(--text-tertiary)', textDecoration: 'underline',
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                marginTop: '0.25rem'
                                                            }}
                                                        >
                                                            {student.onboarding_completed ? 'Undo' : 'Mark Onboarded'}
                                                        </button>
                                                    </div>

                                                    {canDelete && (
                                                        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                                                            <button
                                                                onClick={() => { setTransferringStudent(student); setShowStudentTransferModal(true) }}
                                                                style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', background: 'transparent', border: '1px solid var(--primary)', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                                title="Transfer to another batch"
                                                            >
                                                                <MoveRight size={12} /> Transfer
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteStudent(student.id, student.student_email)}
                                                                style={{ fontSize: '0.75rem', fontWeight: '600', color: 'white', background: 'var(--error, #ef4444)', border: 'none', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                                                            >
                                                                <Trash2 size={12} /> Remove
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                        <p>No students enrolled yet</p>
                    </div>
                )}
            </div>
        </div>
    )
}
