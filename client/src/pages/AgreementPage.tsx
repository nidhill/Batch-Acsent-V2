import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '@/lib/api'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface AgreementSection {
    heading: string
    body: string[]
}

interface AdmissionForm {
    fullName: string
    dateOfBirth: string
    gender: string
    contactNumber: string
    email: string
    address: string
    highestQualification: string
    institutionName: string
    yearOfPassing: string
    courseName: string
    preferredBatchTiming: string
    modeOfStudy: string
    emergencyContactName: string
    emergencyContactRelationship: string
    emergencyContactNumber: string
    registrationFeePaid: string
    paymentMode: string
    paymentModeOther: string
    identityProofType: string
    identityProofTypeOther: string
    identityProofNumber: string
    uploadCopyOfIdentityProof: string
}

const EMPTY_FORM: AdmissionForm = {
    fullName: '', dateOfBirth: '', gender: '', contactNumber: '', email: '', address: '',
    highestQualification: '', institutionName: '', yearOfPassing: '',
    courseName: '', preferredBatchTiming: '', modeOfStudy: '',
    emergencyContactName: '', emergencyContactRelationship: '', emergencyContactNumber: '',
    registrationFeePaid: '', paymentMode: '', paymentModeOther: '',
    identityProofType: '', identityProofTypeOther: '', identityProofNumber: '', uploadCopyOfIdentityProof: '',
}

interface AgreementData {
    studentName: string
    batchName: string
    courseTypeLabel: string
    sections: AgreementSection[]
    status: 'sent' | 'opened' | 'signed'
    signedAt: string | null
    signatureName: string | null
    admissionForm: Partial<AdmissionForm> | null
    prefill: {
        fullName: string
        email: string
        contactNumber: string
        courseName: string
        modeOfStudy: string
    }
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.35rem' }
const fieldWrapStyle: React.CSSProperties = { marginBottom: '0.9rem' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={fieldWrapStyle}>
            <label style={labelStyle}>{label}</label>
            {children}
        </div>
    )
}

export default function AgreementPage() {
    const { admissionId } = useParams<{ admissionId: string }>()
    const [data, setData] = useState<AgreementData | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [signatureName, setSignatureName] = useState('')
    const [form, setForm] = useState<AdmissionForm>(EMPTY_FORM)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [justSigned, setJustSigned] = useState(false)

    useEffect(() => {
        if (!admissionId) return
        fetch(`${API_BASE}/api/learner-agreements/public/${admissionId}`)
            .then(async res => {
                const json = await res.json()
                if (!res.ok) throw new Error(json.error || 'Failed to load agreement')
                setData(json)
                setForm(f => ({
                    ...f,
                    ...(json.admissionForm || {}),
                    fullName: json.admissionForm?.fullName || json.prefill?.fullName || f.fullName,
                    email: json.admissionForm?.email || json.prefill?.email || f.email,
                    contactNumber: json.admissionForm?.contactNumber || json.prefill?.contactNumber || f.contactNumber,
                    courseName: json.admissionForm?.courseName || json.prefill?.courseName || f.courseName,
                    modeOfStudy: json.admissionForm?.modeOfStudy || json.prefill?.modeOfStudy || f.modeOfStudy,
                }))
            })
            .catch(err => setLoadError(err.message || 'Failed to load agreement'))
            .finally(() => setLoading(false))
    }, [admissionId])

    const setF = (key: keyof AdmissionForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [key]: e.target.value }))

    const REQUIRED_FIELDS: (keyof AdmissionForm)[] = [
        'fullName', 'dateOfBirth', 'gender', 'contactNumber', 'email', 'address',
        'highestQualification', 'institutionName', 'yearOfPassing',
        'courseName', 'preferredBatchTiming', 'modeOfStudy',
        'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactNumber',
        'registrationFeePaid', 'paymentMode',
        'identityProofType', 'identityProofNumber', 'uploadCopyOfIdentityProof',
    ]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitError('')
        for (const key of REQUIRED_FIELDS) {
            if (!form[key].trim()) { setSubmitError('Please fill in every field of the admission form above.'); return }
        }
        if (form.paymentMode === 'Other' && !form.paymentModeOther.trim()) { setSubmitError('Please specify the payment mode.'); return }
        if (form.identityProofType === 'Other' && !form.identityProofTypeOther.trim()) { setSubmitError('Please specify the identity proof type.'); return }
        if (!agreed) { setSubmitError('Please confirm you have read and agree to the terms above.'); return }
        if (!signatureName.trim()) { setSubmitError('Please type your full name to sign.'); return }

        setSubmitting(true)
        try {
            const res = await fetch(`${API_BASE}/api/learner-agreements/public/${admissionId}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureName: signatureName.trim(), admissionForm: form }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Failed to submit')
            setJustSigned(true)
        } catch (err: any) {
            setSubmitError(err.message || 'Failed to submit')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
            </div>
        )
    }

    if (loadError || !data) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
                <div className="card" style={{ maxWidth: '440px', textAlign: 'center' }}>
                    <AlertCircle size={32} style={{ color: 'var(--error)', margin: '0 auto 0.75rem' }} />
                    <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Can't open this agreement</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{loadError || 'Invalid link'}</p>
                </div>
            </div>
        )
    }

    const alreadySigned = data.status === 'signed' || justSigned
    const signedAtDisplay = justSigned ? new Date().toLocaleString() : data.signedAt ? new Date(data.signedAt).toLocaleString() : null

    return (
        <div style={{ minHeight: '100vh', padding: '2rem 1rem', background: 'var(--background)' }}>
            <div className="card animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>HACA Learner Agreement</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {data.courseTypeLabel} · {data.batchName} · {data.studentName}
                </p>

                {alreadySigned ? (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <CheckCircle2 size={40} style={{ color: 'var(--success)', margin: '0 auto 0.75rem' }} />
                        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>You've already signed this agreement</p>
                        {signedAtDisplay && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Signed on {signedAtDisplay}</p>}
                    </div>
                ) : (
                    <>
                        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                            {data.sections.map((s, i) => (
                                <div key={i} style={{ marginBottom: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.35rem' }}>{s.heading}</h3>
                                    {s.body.map((p, j) => (
                                        <p key={j} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '0.35rem' }}>{p}</p>
                                    ))}
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.25rem' }}>HACA Learners Admission Form</h3>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>1. Personal Details</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Full Name *"><input className="input" value={form.fullName} onChange={setF('fullName')} /></Field>
                                <Field label="Date of Birth *"><input type="date" className="input" value={form.dateOfBirth} onChange={setF('dateOfBirth')} /></Field>
                                <Field label="Gender *">
                                    <select className="input" value={form.gender} onChange={setF('gender')}>
                                        <option value="">Select</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </Field>
                                <Field label="Contact Number *"><input className="input" value={form.contactNumber} onChange={setF('contactNumber')} /></Field>
                                <Field label="Email Address *"><input type="email" className="input" value={form.email} onChange={setF('email')} /></Field>
                                <Field label="Address *"><input className="input" value={form.address} onChange={setF('address')} /></Field>
                            </div>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>2. Educational Background</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Highest Qualification *"><input className="input" value={form.highestQualification} onChange={setF('highestQualification')} /></Field>
                                <Field label="Institution Name *"><input className="input" value={form.institutionName} onChange={setF('institutionName')} /></Field>
                                <Field label="Year of Passing *"><input className="input" value={form.yearOfPassing} onChange={setF('yearOfPassing')} /></Field>
                            </div>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>3. Course Details</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Course Name *"><input className="input" value={form.courseName} onChange={setF('courseName')} /></Field>
                                <Field label="Preferred Batch Timing *">
                                    <select className="input" value={form.preferredBatchTiming} onChange={setF('preferredBatchTiming')}>
                                        <option value="">Select</option>
                                        <option value="Morning">Morning</option>
                                        <option value="Evening">Evening</option>
                                        <option value="Weekend">Weekend</option>
                                    </select>
                                </Field>
                                <Field label="Mode of Study *">
                                    <select className="input" value={form.modeOfStudy} onChange={setF('modeOfStudy')}>
                                        <option value="">Select</option>
                                        <option value="Online">Online</option>
                                        <option value="Offline">Offline</option>
                                    </select>
                                </Field>
                            </div>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>4. Emergency Contact</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Name *"><input className="input" value={form.emergencyContactName} onChange={setF('emergencyContactName')} /></Field>
                                <Field label="Relationship *"><input className="input" value={form.emergencyContactRelationship} onChange={setF('emergencyContactRelationship')} /></Field>
                                <Field label="Contact Number *"><input className="input" value={form.emergencyContactNumber} onChange={setF('emergencyContactNumber')} /></Field>
                            </div>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>5. Payment Details</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Registration Fee Paid *">
                                    <select className="input" value={form.registrationFeePaid} onChange={setF('registrationFeePaid')}>
                                        <option value="">Select</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                </Field>
                                <Field label="Payment Mode *">
                                    <select className="input" value={form.paymentMode} onChange={setF('paymentMode')}>
                                        <option value="">Select</option>
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </Field>
                                {form.paymentMode === 'Other' && (
                                    <Field label="Specify Payment Mode *"><input className="input" value={form.paymentModeOther} onChange={setF('paymentModeOther')} /></Field>
                                )}
                            </div>

                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0.5rem 0 0.25rem' }}>6. Identity Proof</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>
                                <Field label="Type of Identity Proof *">
                                    <select className="input" value={form.identityProofType} onChange={setF('identityProofType')}>
                                        <option value="">Select</option>
                                        <option value="Aadhaar Card">Aadhaar Card</option>
                                        <option value="Passport">Passport</option>
                                        <option value="Driver's License">Driver's License</option>
                                        <option value="Voter ID">Voter ID</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </Field>
                                {form.identityProofType === 'Other' && (
                                    <Field label="Specify Identity Proof *"><input className="input" value={form.identityProofTypeOther} onChange={setF('identityProofTypeOther')} /></Field>
                                )}
                                <Field label="Identity Proof Number *"><input className="input" value={form.identityProofNumber} onChange={setF('identityProofNumber')} /></Field>
                                <Field label="Upload Copy of Identity Proof (if online submission) *">
                                    <select className="input" value={form.uploadCopyOfIdentityProof} onChange={setF('uploadCopyOfIdentityProof')}>
                                        <option value="">Select</option>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                </Field>
                            </div>

                            <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0 1rem' }} />

                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop: '0.2rem' }} />
                                I have read and understood the HACA Learner Agreement above, and I agree to its terms.
                            </label>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Type your full name to sign *</label>
                                <input
                                    className="input"
                                    value={signatureName}
                                    onChange={e => setSignatureName(e.target.value)}
                                    placeholder={data.studentName}
                                />
                            </div>

                            {submitError && (
                                <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{submitError}</p>
                            )}

                            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
                                {submitting ? 'Submitting…' : 'Sign Agreement'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}
