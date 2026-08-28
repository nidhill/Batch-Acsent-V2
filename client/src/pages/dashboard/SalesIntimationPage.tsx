import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Send } from 'lucide-react'
import { PAYMENT_STATUSES, PAYMENT_METHODS, PAYMENT_CHANNELS, LEAD_SOURCES } from '@/lib/constants'

export default function SalesIntimationPage() {
    const [searchParams] = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        student_name: searchParams.get('student_name') || '',
        contact_number: searchParams.get('contact_number') || '',
        whatsapp_number: '',
        email: searchParams.get('email') || '',
        address: '',
        guardian_name: '',
        guardian_contact: '',
        age: '',
        gender: '',
        city: '',
        state: '',
        region: '',
        admission_date: '',
        lead_creation_date: '',
        lead_source: searchParams.get('lead_source') || '',
        school: '',
        batch_code: '',
        sales_user_id: '',
        discount: '0',
        scholarship: '0',
        payment_status: 'partial',
        payment_method: '',
        payment_channel: 'online',
        amount_paid: '',
        next_due_date: '',
        transaction_number: '',
        receipt_number: '',
        remarks: '',
        pledge_accepted: false
    })
    const [documents, setDocuments] = useState<{ photo: File | null; id_proof: File | null; qualification_cert: File | null }>({
        photo: null, id_proof: null, qualification_cert: null,
    })

    const [schoolsList, setSchoolsList] = useState<any[]>([])
    const [regionsList, setRegionsList] = useState<any[]>([])
    const [batchesList, setBatchesList] = useState<any[]>([])
    const [userSchool, setUserSchool] = useState<string | null>(null)
    const [userRole, setUserRole] = useState<string | null>(null)
    const [salesExecutives, setSalesExecutives] = useState<any[]>([])
    const [duplicateMatches, setDuplicateMatches] = useState<any[]>([])

    // Fetch User Profile and Schools on mount
    useEffect(() => {
        const initialize = async () => {
            try {
                const meRes = await authedFetch('/api/auth/profile')
                const me = await meRes.json()
                const userData = me.profile

                // Only SALES reps are actually tied to one school — SALES_HEAD/ADMIN/CEO can
                // submit admissions for any school, so their profile's `school` (often just a
                // leftover from an earlier role) must not lock this field.
                if (userData?.school && userData.role === 'SALES') {
                    setUserSchool(userData.school)
                    setFormData(prev => ({ ...prev, school: userData.school }))
                }
                setUserRole(userData?.role || null)

                // ADMIN/CEO/SALES_HEAD generally have no sales_id of their own — they must
                // explicitly pick which Sales Executive gets credit for this admission.
                if (userData?.role && userData.role !== 'SALES') {
                    const salesRes = await authedFetch('/api/users?directory=1&role=SALES')
                    const salesData = await salesRes.json()
                    setSalesExecutives(salesData.users || [])
                }

                const schoolsRes = await authedFetch('/api/schools')
                const schoolsData = await schoolsRes.json()
                if (schoolsData.schools) {
                    setSchoolsList(schoolsData.schools.map((s: any) => ({ ...s, id: s._id })))
                }

                const regionsRes = await authedFetch('/api/regions')
                const regionsData = await regionsRes.json()
                setRegionsList(regionsData.regions || [])
            } catch (err) {
                console.error('Error initializing page:', err)
            }
        }
        initialize()
    }, [])

    // Fetch Batches when school selection changes
    useEffect(() => {
        const fetchBatches = async () => {
            if (!formData.school) {
                setBatchesList([])
                return
            }

            try {
                const res = await authedFetch('/api/batches?view=all')
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)

                const todayStr = new Date().toISOString().split('T')[0]
                // Same "still worth enrolling into" scoping as the Sales Dashboard batch
                // cards: upcoming, or started within the last month (late admissions are
                // common early on). Full batches stay in the list (strength is a planning
                // number, not a hard cap) — the dropdown flags them instead of hiding them,
                // so a rep can still knowingly over-enroll one when there's real room.
                const oneMonthAgo = new Date()
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
                const relevant = (data.batches || []).filter((b: any) =>
                    b.school === formData.school
                    && (!b.end_date || b.end_date >= todayStr)
                    && new Date(b.start_date) >= oneMonthAgo
                )
                setBatchesList(relevant.map((batch: any) => ({
                    ...batch,
                    current_count: batch.enrolled_count || 0,
                    is_full: (batch.enrolled_count || 0) >= batch.strength,
                })))
            } catch (err) {
                console.error('Error fetching batches:', err)
            }
        }
        fetchBatches()
    }, [formData.school])

    // Flags when the email/mobile just entered already belongs to an existing admission, so the
    // person filling this in sees it immediately (on blur, not every keystroke, to avoid
    // spamming the API) — the actual block happens both here (pre-submit) and, authoritatively,
    // server-side in POST /api/admissions since a client-only check can be bypassed.
    const checkDuplicate = async (email: string, phone: string) => {
        if (!email && !phone) {
            setDuplicateMatches([])
            return []
        }
        try {
            const params = new URLSearchParams()
            if (email) params.set('email', email.trim())
            if (phone) params.set('phone', phone.trim())
            const res = await authedFetch(`/api/admissions/check-duplicate?${params.toString()}`)
            const data = await res.json()
            const matches = data.matches || []
            setDuplicateMatches(matches)
            return matches
        } catch (err) {
            console.error('Error checking duplicate:', err)
            return []
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    // Course fee is auto-fetched from the selected batch — Sales cannot edit it directly,
    // only apply a discount/scholarship on top (SRS Doc 3 §"Course Fee").
    const selectedBatch = batchesList.find(b => b.id === formData.batch_code)
    const courseFee = selectedBatch?.course_fee || 0
    const finalFee = Math.max(0, courseFee - (parseFloat(formData.discount) || 0) - (parseFloat(formData.scholarship) || 0))
    const remainingAfterThisPayment = Math.max(0, finalFee - (parseFloat(formData.amount_paid) || 0))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.pledge_accepted) {
            alert('You must accept the pledge to submit.')
            return
        }
        if (userRole && userRole !== 'SALES' && !formData.sales_user_id) {
            alert('Please select which Sales Executive this admission should be credited to.')
            return
        }

        const freshMatches = await checkDuplicate(formData.email, formData.contact_number)
        if (freshMatches.length > 0) {
            alert('A student with this email or mobile number already exists. Duplicate admissions are not allowed — please verify the details.')
            return
        }

        setLoading(true)

        try {
            const batchId = formData.batch_code
            if (!batchId) throw new Error('Batch selection missing or invalid.')
            // A warning, not a hard block — strength is a planning number, not a wall. The rep
            // still has to consciously say yes to enrolling past it.
            if (selectedBatch?.is_full) {
                const proceed = confirm(`The batch "${selectedBatch.name}" is already full (${selectedBatch.current_count}/${selectedBatch.strength} seats). Enroll this student anyway?`)
                if (!proceed) return
            }

            const res = await authedFetch('/api/admissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    batch_id: batchId,
                    sales_user_id: formData.sales_user_id || undefined,
                    student_name: formData.student_name,
                    student_email: formData.email,
                    student_phone: formData.contact_number,
                    whatsapp_number: formData.whatsapp_number,
                    address: formData.address,
                    guardian_name: formData.guardian_name,
                    guardian_contact: formData.guardian_contact,
                    age: formData.age,
                    gender: formData.gender,
                    city: formData.city,
                    state: formData.state,
                    region: formData.region,
                    lead_source: formData.lead_source,
                    admission_date: formData.admission_date,
                    lead_creation_date: formData.lead_creation_date,
                    discount: formData.discount,
                    scholarship: formData.scholarship,
                    payment_status: formData.payment_status,
                    payment_method: formData.payment_method,
                    payment_channel: formData.payment_channel,
                    amount_paid: formData.amount_paid,
                    next_due_date: formData.next_due_date,
                    transaction_number: formData.transaction_number,
                    receipt_number: formData.receipt_number,
                    remarks: formData.remarks,
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to submit admission')

            const admissionId = data.admission?.id
            if (admissionId) {
                const uploads = Object.entries(documents).filter(([, file]) => file) as [string, File][]
                for (const [type, file] of uploads) {
                    const fd = new FormData()
                    fd.append('type', type)
                    fd.append('file', file)
                    try {
                        const upRes = await authedFetch(`/api/admissions/${admissionId}/documents`, { method: 'POST', body: fd })
                        if (!upRes.ok) {
                            const upData = await upRes.json()
                            console.error(`Failed to upload ${type}:`, upData.error)
                        }
                    } catch (upErr) {
                        console.error(`Failed to upload ${type}:`, upErr)
                    }
                }
            }

            alert('Student Admission submitted successfully!')
            fetchRecentAdmissions()
            setDuplicateMatches([])
            setFormData({
                student_name: '', contact_number: '', whatsapp_number: '', email: '',
                address: '', guardian_name: '', guardian_contact: '',
                age: '', gender: '', city: '', state: '', region: '',
                admission_date: '', lead_creation_date: '', lead_source: '',
                school: userSchool || '', batch_code: '', sales_user_id: '',
                discount: '0', scholarship: '0', payment_status: 'partial', payment_method: '',
                payment_channel: 'online', amount_paid: '', next_due_date: '',
                transaction_number: '', receipt_number: '', remarks: '', pledge_accepted: false
            })
            setDocuments({ photo: null, id_proof: null, qualification_cert: null })

        } catch (error: any) {
            console.error('Error submitting form:', error)
            alert('Error submitting form: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const [recentAdmissions, setRecentAdmissions] = useState<any[]>([])
    const fetchRecentAdmissions = async () => {
        try {
            const res = await authedFetch('/api/admissions?limit=5')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setRecentAdmissions(data.admissions || [])
        } catch (err) {
            console.error('Error fetching recent admissions:', err)
        }
    }

    useEffect(() => {
        fetchRecentAdmissions()
    }, [])

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Send size={24} /> Student Admission
            </h2>
            <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                Purpose: To communicate all necessary post-sales student details for seamless onboarding, orientation, and academic handover.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>

                {/* ADMIN/CEO/SALES_HEAD have no sales_id of their own, so they must pick who
                    this admission is credited to — placed first, above every other section, so
                    it can't be missed (it was previously buried inside Admission Details, far
                    down the form, where it went unnoticed). */}
                {userRole && userRole !== 'SALES' && (
                    <section style={{ background: 'var(--primary-light)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--primary)' }}>
                        <label className="block mb-1 text-sm font-medium" style={{ color: 'var(--primary-dark)' }}>Credit To (Sales Executive) *</label>
                        <select
                            name="sales_user_id"
                            className="input"
                            required
                            value={formData.sales_user_id}
                            onChange={handleChange}
                        >
                            <option value="">Select Sales Executive</option>
                            {salesExecutives.map(u => (
                                <option key={u._id} value={u._id}>{u.name} {u.sales_id ? `(${u.sales_id})` : ''}</option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                            Required — this admission will be credited to whoever you select here.
                        </p>
                    </section>
                )}

                {/* Basic Student Details */}
                <section>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Student Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Full Name of Student *</label>
                            <input type="text" name="student_name" className="input" required value={formData.student_name} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Mobile Number *</label>
                            <input type="tel" name="contact_number" className="input" required value={formData.contact_number} onChange={handleChange} onBlur={() => checkDuplicate(formData.email, formData.contact_number)} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">WhatsApp Number *</label>
                            <input type="tel" name="whatsapp_number" className="input" required value={formData.whatsapp_number} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Email Address *</label>
                            <input type="email" name="email" className="input" required value={formData.email} onChange={handleChange} onBlur={() => checkDuplicate(formData.email, formData.contact_number)} />
                        </div>
                        {duplicateMatches.length > 0 && (
                            <div style={{ gridColumn: '1 / -1', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#991b1b' }}>
                                <strong>Duplicate — cannot submit:</strong> a student with this {duplicateMatches[0].matched_field === 'email' ? 'email' : 'mobile number'} already exists.
                                {duplicateMatches.map((m, i) => (
                                    <div key={i} style={{ marginTop: '0.25rem' }}>
                                        {m.student_name} — {m.student_email} / {m.student_phone}{m.batch_name ? ` · enrolled in ${m.batch_name}` : ''}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="block mb-1 text-sm font-medium">Address *</label>
                            <input type="text" name="address" className="input" required value={formData.address} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Guardian Name *</label>
                            <input type="text" name="guardian_name" className="input" required value={formData.guardian_name} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Guardian Contact *</label>
                            <input type="tel" name="guardian_contact" className="input" required value={formData.guardian_contact} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Age *</label>
                            <input type="number" name="age" className="input" required min="1" max="120" value={formData.age} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Gender *</label>
                            <select name="gender" className="input" required value={formData.gender} onChange={handleChange}>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">City *</label>
                            <input type="text" name="city" className="input" required value={formData.city} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">State *</label>
                            <input type="text" name="state" className="input" required value={formData.state} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Region *</label>
                            <select name="region" className="input" required value={formData.region} onChange={handleChange}>
                                <option value="">Select Region</option>
                                {regionsList.map(r => <option key={r._id} value={r.name}>{r.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Date of Admission Confirmation *</label>
                            <input type="date" name="admission_date" className="input" required value={formData.admission_date} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Date of Lead Creation *</label>
                            <input type="date" name="lead_creation_date" className="input" required value={formData.lead_creation_date} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Lead Source *</label>
                            <select name="lead_source" className="input" required value={formData.lead_source} onChange={handleChange}>
                                <option value="">Select Source</option>
                                {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Program Details */}
                <section>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Admission Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label className="block mb-1 text-sm font-medium">School *</label>
                            <select
                                name="school"
                                className="input"
                                required
                                value={formData.school}
                                onChange={handleChange}
                                disabled={!!userSchool}
                                style={userSchool ? { background: 'var(--surface-hover)', cursor: 'not-allowed' } : {}}
                            >
                                <option value="">Select School</option>
                                {schoolsList.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Batch *</label>
                            <select
                                name="batch_code"
                                className="input"
                                required
                                disabled={!formData.school}
                                value={formData.batch_code}
                                onChange={handleChange}
                                style={!formData.school ? { background: 'var(--surface-hover)', cursor: 'not-allowed' } : {}}
                            >
                                <option value="">{formData.school ? 'Select Batch' : 'Select a School first'}</option>
                                {batchesList.map(batch => (
                                    <option key={batch.id} value={batch.id}>
                                        {batch.name} ({batch.id}) ({batch.current_count}/{batch.strength}){batch.is_full ? ' — FULL, over-enrolling' : ''}
                                    </option>
                                ))}
                            </select>
                            {formData.school && batchesList.length === 0 && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem' }}>No open batches found for {formData.school}.</p>
                            )}
                            {selectedBatch?.is_full && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                                    This batch is already full ({selectedBatch.current_count}/{selectedBatch.strength}) — you'll be asked to confirm on submit.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Auto-derived from batch selection, per SRS: Course Fee / Start Date / Orientation Date / Region */}
                    {selectedBatch && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRadius: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                            <div><strong>Course Fee:</strong> ₹{courseFee.toLocaleString()}</div>
                            <div><strong>Batch Start:</strong> {selectedBatch.start_date ? new Date(selectedBatch.start_date).toLocaleDateString('en-GB') : '—'}</div>
                            <div><strong>Orientation Date:</strong> {selectedBatch.orientation_date ? new Date(selectedBatch.orientation_date).toLocaleDateString('en-GB') : '—'}</div>
                            <div><strong>Available Seats:</strong> {(selectedBatch.strength || 0) - (selectedBatch.enrolled_count || 0)}</div>
                            <div><strong>Region:</strong> {selectedBatch.region || '—'}</div>
                        </div>
                    )}
                </section>

                {/* Payment */}
                <section>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Payment</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Discount (₹) *</label>
                            <input type="number" name="discount" className="input" required min="0" value={formData.discount} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Scholarship (₹)</label>
                            <input type="number" name="scholarship" className="input" min="0" value={formData.scholarship} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Final Fee</label>
                            <div className="input" style={{ background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', fontWeight: 600 }}>₹{finalFee.toLocaleString()}</div>
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">Payment Status *</label>
                            <select name="payment_status" className="input" required value={formData.payment_status} onChange={handleChange}>
                                {PAYMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Payment Method *</label>
                            <select name="payment_method" className="input" required value={formData.payment_method} onChange={handleChange}>
                                <option value="">Select Method</option>
                                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Payment Channel *</label>
                            <select name="payment_channel" className="input" required value={formData.payment_channel} onChange={handleChange}>
                                {PAYMENT_CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block mb-1 text-sm font-medium">Amount Paid Now (₹) *</label>
                            <input type="number" name="amount_paid" className="input" required min="0" value={formData.amount_paid} onChange={handleChange} />
                        </div>

                        {formData.payment_status !== 'full' && (
                            <div>
                                <label className="block mb-1 text-sm font-medium">Next Due Date *</label>
                                <input type="date" name="next_due_date" className="input" required value={formData.next_due_date} onChange={handleChange} />
                            </div>
                        )}

                        <div>
                            <label className="block mb-1 text-sm font-medium">Transaction Number</label>
                            <input type="text" name="transaction_number" className="input" value={formData.transaction_number} onChange={handleChange} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Receipt Number</label>
                            <input type="text" name="receipt_number" className="input" value={formData.receipt_number} onChange={handleChange} />
                        </div>

                        {formData.amount_paid !== '' && (
                            <div style={{ gridColumn: '1 / -1', fontSize: '0.85rem', color: remainingAfterThisPayment > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                                Remaining after this payment: ₹{remainingAfterThisPayment.toLocaleString()}
                            </div>
                        )}

                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className="block mb-1 text-sm font-medium">Remarks</label>
                            <textarea name="remarks" className="input" rows={3} value={formData.remarks} onChange={handleChange}></textarea>
                        </div>
                    </div>
                </section>

                {/* Document Upload */}
                <section>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Documents</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Student Photo</label>
                            <input type="file" accept="image/*" className="input" onChange={(e) => setDocuments(prev => ({ ...prev, photo: e.target.files?.[0] || null }))} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">ID Proof</label>
                            <input type="file" accept="image/*,.pdf" className="input" onChange={(e) => setDocuments(prev => ({ ...prev, id_proof: e.target.files?.[0] || null }))} />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium">Qualification Certificate</label>
                            <input type="file" accept="image/*,.pdf" className="input" onChange={(e) => setDocuments(prev => ({ ...prev, qualification_cert: e.target.files?.[0] || null }))} />
                        </div>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Optional at this stage — max 5MB per file, uploaded once the admission is submitted.</p>
                </section>

                {/* Pledge */}
                <section style={{ background: 'var(--surface-hover)', padding: '1rem', borderRadius: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <input
                            type="checkbox"
                            name="pledge_accepted"
                            id="pledge"
                            checked={formData.pledge_accepted}
                            onChange={handleChange}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <label htmlFor="pledge" style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>
                            I pledge that there are no false promises or unverified details shared with the candidate. If any concerns are escalated, I will be happy to share the proofs to support my claims. I take full responsibility for the data in this form.
                        </label>
                    </div>
                </section>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                    {loading ? 'Submitting...' : 'Submit Admission'}
                </button>
            </form>

            {/* Recent Admissions List */}
            <div className="card mt-12" style={{ marginTop: '3rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Your Recent Admissions</h3>
                {recentAdmissions.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No recent submissions found.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem' }}>Student Name</th>
                                    <th style={{ padding: '0.75rem' }}>Batch</th>
                                    <th style={{ padding: '0.75rem' }}>Date</th>
                                    <th style={{ padding: '0.75rem' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAdmissions.map((admission) => (
                                    <tr key={admission.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.875rem' }}>
                                        <td style={{ padding: '0.75rem' }}>{admission.student_name}</td>
                                        <td style={{ padding: '0.75rem' }}>{admission.batch_name || admission.batch_id}</td>
                                        <td style={{ padding: '0.75rem' }}>{admission.enrolled_at ? new Date(admission.enrolled_at).toLocaleDateString() : 'N/A'}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                background: admission.status === 'Verified' ? 'var(--success-light)' : 'var(--warning-light)',
                                                color: admission.status === 'Verified' ? 'var(--success)' : 'var(--warning)',
                                                fontSize: '0.75rem',
                                                fontWeight: '600'
                                            }}>
                                                {admission.status}
                                            </span>
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
