import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { CheckCircle, UserPlus, Users, Building, Phone, Mail, User, Monitor, MapPin, Filter, BookOpen, ArrowRight, ArrowLeft } from 'lucide-react'

interface Batch {
    id: string
    name: string
    mode: string
    school: string
    course: string
    start_date: string
}

interface SalesPerson {
    id: string
    name: string
    sales_id: string
    school: string
}

export default function LinkStudentPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [generatedId, setGeneratedId] = useState<string | null>(null)
    const [step, setStep] = useState(1) // 1: Details, 2: Batch, 3: Counselor

    const [batches, setBatches] = useState<Batch[]>([])
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])

    const [filters, setFilters] = useState({
        mode: 'ALL' as 'ALL' | 'Online' | 'Offline',
        school: 'ALL' as string,
        course: 'ALL' as string
    })

    // Track selected batch details separately for display
    const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)

    const [formData, setFormData] = useState({
        student_name: '',
        student_email: '',
        student_phone: '',
        batch_id: '',
        sales_user_id: ''
    })

    useEffect(() => {
        fetchMetadata()
    }, [])

    const fetchMetadata = async () => {
        try {
            const batchRes = await authedFetch('/api/batches?view=all')
            const batchData = await batchRes.json()
            if (batchData.batches) setBatches(batchData.batches)

            const salesRes = await authedFetch('/api/users?directory=1&role=SALES')
            const salesData = await salesRes.json()
            if (salesData.users) setSalesPersons(salesData.users.map((u: any) => ({ ...u, id: u._id })))
        } catch (error) {
            console.error('Error fetching metadata:', error)
        }
    }

    // Derive available courses based on selected school to keep the list relevant
    const availableCourses = Array.from(new Set(
        batches
            .filter(b => filters.school === 'ALL' || b.school === filters.school)
            .map(b => b.course)
            .filter(Boolean) // Remove nulls/undefined
    )).sort()

    const filteredBatches = batches.filter(batch => {
        const matchesMode = filters.mode === 'ALL' || batch.mode?.toLowerCase() === filters.mode.toLowerCase()
        const matchesSchool = filters.school === 'ALL' || batch.school === filters.school
        const matchesCourse = filters.course === 'ALL' || batch.course === filters.course
        return matchesMode && matchesSchool && matchesCourse
    })

    const filteredSalesPersons = salesPersons.filter(person => {
        if (selectedBatch && selectedBatch.school) {
            return !person.school || person.school === selectedBatch.school
        }
        return true
    })

    const handleSubmit = async () => {
        setLoading(true)
        setSuccess(false)
        setGeneratedId(null)

        try {
            const response = await authedFetch('/api/link-student', {
                method: 'POST',
                body: JSON.stringify({
                    student_name: formData.student_name,
                    student_email: formData.student_email,
                    student_phone: formData.student_phone,
                    batch_id: formData.batch_id,
                    sales_user_id: formData.sales_user_id
                })
            })

            const data = await response.json()

            if (!response.ok) {
                if (response.status === 409 && data.code === 'BATCH_FULL') {
                    throw new Error(data.message || 'Batch is full. Logic handled by webhook.')
                }
                throw new Error(data.error || 'Failed to link student')
            }

            setSuccess(true)
            if (data.generated_id) {
                setGeneratedId(data.generated_id)
            } else if (data.student?.student_id) {
                setGeneratedId(data.student.student_id)
            } else {
                setGeneratedId('ID Generated')
            }

        } catch (error: any) {
            console.error('Error linking student:', error)

            // If the error message came from our 409 response, using data.message or similar
            // But since fetch throws on !ok only if we don't parse body first...
            // Actually, we parsed data above. The throw new Error(data.error) might mask the code.
            // Let's rely on the alert.

            alert('Error: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setFormData({
            student_name: '',
            student_email: '',
            student_phone: '',
            batch_id: '',
            sales_user_id: ''
        })
        setFilters({ mode: 'ALL', school: 'ALL', course: 'ALL' })
        setSelectedBatch(null)
        setSuccess(false)
        setStep(1)
    }

    // Step 1: Student Details
    const renderStep1 = () => (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Step 1: Student Details</h3>
            <div>
                <label className="label">Full Name</label>
                <div style={{ position: 'relative' }}>
                    <User size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="e.g. John Doe"
                        value={formData.student_name}
                        onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    />
                </div>
            </div>
            <div>
                <label className="label">Email Address</label>
                <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="email"
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="student@example.com"
                        value={formData.student_email}
                        onChange={(e) => setFormData({ ...formData, student_email: e.target.value })}
                    />
                </div>
            </div>
            <div>
                <label className="label">Phone Number</label>
                <div style={{ position: 'relative' }}>
                    <Phone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="tel"
                        className="input"
                        style={{ paddingLeft: '2.5rem' }}
                        placeholder="+91 98765 43210"
                        value={formData.student_phone}
                        onChange={(e) => setFormData({ ...formData, student_phone: e.target.value })}
                    />
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem' }}>
                <button
                    onClick={() => {
                        if (formData.student_name && formData.student_email && formData.student_phone) {
                            setStep(2)
                        } else {
                            alert('Please fill in all details')
                        }
                    }}
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 1.5rem' }}
                >
                    Next <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                </button>
            </div>
        </div>
    )

    // Step 2: Select Batch
    const renderStep2 = () => (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Step 2: Select Batch</h3>
                <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <ArrowLeft size={14} /> Back
                </button>
            </div>

            {/* Filters */}
            <div style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* School Filter */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFilters(prev => ({ ...prev, school: 'ALL', course: 'ALL' }))}
                        style={{
                            padding: '0.25rem 0.75rem', fontSize: '0.875rem', borderRadius: '999px',
                            border: `1px solid ${filters.school === 'ALL' ? 'var(--primary)' : 'var(--border)'}`,
                            background: filters.school === 'ALL' ? 'var(--primary)' : 'var(--surface)',
                            color: filters.school === 'ALL' ? 'white' : 'var(--text-secondary)',
                            fontWeight: filters.school === 'ALL' ? '500' : 'normal',
                            cursor: 'pointer'
                        }}
                    >
                        All Schools
                    </button>
                    {Array.from(new Set(batches.map(b => b.school).filter(Boolean))).sort().map(school => (
                        <button
                            key={school}
                            onClick={() => setFilters(prev => ({ ...prev, school: school, course: 'ALL' }))}
                            style={{
                                padding: '0.25rem 0.75rem', fontSize: '0.875rem', borderRadius: '999px',
                                border: `1px solid ${filters.school === school ? 'var(--primary)' : 'var(--border)'}`,
                                background: filters.school === school ? 'var(--primary)' : 'var(--surface)',
                                color: filters.school === school ? 'white' : 'var(--text-secondary)',
                                fontWeight: filters.school === school ? '500' : 'normal',
                                cursor: 'pointer'
                            }}
                        >
                            {school.replace(' School', '')}
                        </button>
                    ))}
                </div>

                {/* Course & Mode Filter Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', padding: '2px' }}>
                        {[
                            { id: 'ALL', icon: Filter, label: 'All Modes' },
                            { id: 'Online', icon: Monitor, label: 'Online' },
                            { id: 'Offline', icon: MapPin, label: 'Offline' }
                        ].map((mode) => (
                            <button
                                key={mode.id}
                                onClick={() => setFilters(prev => ({ ...prev, mode: mode.id as any }))}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.875rem', borderRadius: 'var(--radius-sm)', border: 'none',
                                    background: filters.mode === mode.id ? 'var(--primary-light)' : 'transparent',
                                    color: filters.mode === mode.id ? 'var(--primary)' : 'var(--text-secondary)',
                                    fontWeight: filters.mode === mode.id ? '500' : 'normal',
                                    cursor: 'pointer'
                                }}
                            >
                                <mode.icon size={14} />
                                {mode.label}
                            </button>
                        ))}
                    </div>

                    {availableCourses.length > 0 && (
                        <select
                            className="input"
                            style={{ width: 'auto', padding: '0.375rem 0.75rem', height: 'auto' }}
                            value={filters.course}
                            onChange={(e) => setFilters(prev => ({ ...prev, course: e.target.value }))}
                        >
                            <option value="ALL">All Courses</option>
                            {availableCourses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                </div>
            </div>

            {/* Batches List */}
            <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {filteredBatches.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No batches found matching filters.</div>
                ) : (
                    filteredBatches.map(batch => (
                        <div
                            key={batch.id}
                            onClick={() => {
                                setFormData(prev => ({ ...prev, batch_id: batch.id }))
                                setSelectedBatch(batch)
                                setStep(3)
                            }}
                            className="card-hover-effect"
                            style={{
                                padding: '1rem',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                background: 'var(--surface)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--primary)'
                                e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                                e.currentTarget.style.transform = 'translateY(-2px)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border)'
                                e.currentTarget.style.boxShadow = 'none'
                                e.currentTarget.style.transform = 'translateY(0)'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: '600', fontSize: '1.125rem', marginBottom: '0.25rem' }}>{batch.name}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building size={12} /> {batch.school}</span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                        {batch.mode === 'Online' ? <Monitor size={12} /> : <MapPin size={12} />}
                                        {batch.mode}
                                    </span>
                                    {batch.course && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><BookOpen size={12} /> {batch.course}</span>}
                                </div>
                            </div>
                            <div style={{ color: 'var(--primary)' }}>
                                <ArrowRight size={20} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )

    // Step 3: Select Counselor & Confirm
    const renderStep3 = () => (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Step 3: Assign Counselor</h3>
                <button onClick={() => setStep(2)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                    <ArrowLeft size={14} /> Back
                </button>
            </div>

            {/* Selected Context */}
            <div style={{ background: 'var(--primary-light)', border: '1px solid rgba(37,99,235,0.2)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Linking Student</div>
                    <div style={{ fontWeight: 'bold' }}>{formData.student_name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{formData.student_email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>To Batch</div>
                    <div style={{ fontWeight: 'bold' }}>{selectedBatch?.name}</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{selectedBatch?.school} • {selectedBatch?.mode}</div>
                </div>
            </div>

            {/* Counselor Selection */}
            <div>
                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Select Sales Counselor ({filteredSalesPersons.length})</label>
                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {filteredSalesPersons.map(person => (
                        <div
                            key={person.id}
                            onClick={() => setFormData(prev => ({ ...prev, sales_user_id: person.id }))}
                            style={{
                                padding: '0.75rem',
                                border: formData.sales_user_id === person.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: formData.sales_user_id === person.id ? 'var(--primary-light)' : 'var(--surface)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: '500' }}>{person.name}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ID: {person.sales_id || 'N/A'} {person.school ? `• ${person.school}` : ''}</div>
                            </div>
                            {formData.sales_user_id === person.id && <CheckCircle size={20} style={{ color: 'var(--primary)' }} />}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <button
                    onClick={handleSubmit}
                    disabled={!formData.sales_user_id || loading}
                    className="btn btn-primary"
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                >
                    {loading ? 'Processing...' : 'Complete Linking'}
                </button>
            </div>
        </div>
    )

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
            <div className="card">
                {success ? (
                    <div className="animate-scale-in" style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <div style={{ margin: '0 auto 1rem', width: '4rem', height: '4rem', background: 'var(--success-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={32} style={{ color: 'var(--success)' }} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Success!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Student has been linked and onboarded.</p>

                        {generatedId && generatedId !== 'ID Generated' && (
                            <div style={{ background: 'white', border: '2px dashed var(--success)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: '2rem', display: 'inline-block' }}>
                                <div style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Student ID</div>
                                <div style={{ fontSize: '1.875rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--success)' }}>{generatedId}</div>
                            </div>
                        )}

                        <div>
                            <button onClick={resetForm} className="btn btn-primary">Link Another Student</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <UserPlus size={24} style={{ color: 'var(--primary)' }} />
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Link Student</h2>
                                </div>
                                <button
                                    onClick={() => navigate('/dashboard/link-student/bulk')}
                                    className="btn"
                                    style={{
                                        fontSize: '0.875rem', padding: '0.4rem 0.8rem',
                                        background: 'transparent',
                                        border: '1px solid var(--primary)',
                                        color: 'var(--primary)',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Users size={16} /> Bulk Link Mode
                                </button>
                            </div>
                            {/* Progress Steps */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {[1, 2, 3].map(s => (
                                    <div key={s} style={{ height: '6px', flex: 1, borderRadius: '99px', background: s <= step ? 'var(--primary)' : 'var(--border)', transition: 'background 0.3s' }} />
                                ))}
                            </div>
                        </div>

                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                    </>
                )}
            </div>
        </div>
    )
}
