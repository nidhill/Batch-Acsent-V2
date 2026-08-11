import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '@/lib/api'
import {
    CheckCircle2, AlertCircle, User, GraduationCap, BookOpen, Users, CreditCard,
    Fingerprint, ArrowRight, ArrowLeft, PenLine, Loader2,
} from 'lucide-react'
import s from './AgreementPage.module.css'

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

const REQUIRED_FIELDS: (keyof AdmissionForm)[] = [
    'fullName', 'dateOfBirth', 'gender', 'contactNumber', 'email', 'address',
    'highestQualification', 'institutionName', 'yearOfPassing',
    'courseName', 'preferredBatchTiming', 'modeOfStudy',
    'emergencyContactName', 'emergencyContactRelationship', 'emergencyContactNumber',
    'registrationFeePaid', 'paymentMode',
    'identityProofType', 'identityProofNumber', 'uploadCopyOfIdentityProof',
]

const STEP_LABELS = ['Terms', 'Your Details', 'Sign']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={s.field}>
            <label className={s.fieldLabel}>{label}</label>
            {children}
        </div>
    )
}

export default function AgreementPage() {
    const { admissionId } = useParams<{ admissionId: string }>()
    const [data, setData] = useState<AgreementData | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    const [step, setStep] = useState<1 | 2 | 3>(1)
    const [agreed, setAgreed] = useState(false)
    const [scrollPct, setScrollPct] = useState(0)
    const [form, setForm] = useState<AdmissionForm>(EMPTY_FORM)
    const [signatureName, setSignatureName] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [justSigned, setJustSigned] = useState(false)
    const readScrollRef = useRef<HTMLDivElement>(null)

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

    const handleReadScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        const max = el.scrollHeight - el.clientHeight
        setScrollPct(max <= 0 ? 100 : Math.min(100, Math.max(0, (el.scrollTop / max) * 100)))
    }

    const goToStep2 = () => {
        if (!agreed) { setSubmitError('Please confirm you have read and agree to the terms above.'); return }
        setSubmitError('')
        setStep(2)
    }

    const goToStep3 = () => {
        for (const key of REQUIRED_FIELDS) {
            if (!form[key].trim()) { setSubmitError('Please fill in every field of the admission form.'); return }
        }
        if (form.paymentMode === 'Other' && !form.paymentModeOther.trim()) { setSubmitError('Please specify the payment mode.'); return }
        if (form.identityProofType === 'Other' && !form.identityProofTypeOther.trim()) { setSubmitError('Please specify the identity proof type.'); return }
        setSubmitError('')
        setStep(3)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitError('')
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
            <div className={s.centerScreen}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={30} className={s.spinner} style={{ marginBottom: '0.75rem' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading your agreement…</p>
                </div>
            </div>
        )
    }

    if (loadError || !data) {
        return (
            <div className={s.centerScreen}>
                <div className={s.card} style={{ maxWidth: '420px', textAlign: 'center' }}>
                    <AlertCircle size={32} style={{ color: 'var(--error)', margin: '0 auto 0.75rem' }} />
                    <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Can't open this agreement</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{loadError || 'Invalid link'}</p>
                </div>
            </div>
        )
    }

    const alreadySigned = data.status === 'signed' || justSigned
    const signedAtDisplay = justSigned ? new Date().toLocaleString() : data.signedAt ? new Date(data.signedAt).toLocaleString() : null
    const displaySignature = justSigned ? signatureName.trim() : (data.signatureName || '')

    return (
        <div className={s.page}>
            <div className={s.hero}>
                <div className={s.heroInner}>
                    <div className={s.logoBadge}>
                        <img src="/logo-new.png" alt="HACA" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className={s.eyebrow}>Harris &amp; Co Academy</div>
                    <h1 className={s.heroTitle}>
                        {alreadySigned ? `Thanks, ${data.studentName.split(' ')[0]}` : `Welcome, ${data.studentName.split(' ')[0]}`}
                    </h1>
                    <div className={s.metaRow}>
                        <span className={s.metaChip}>{data.courseTypeLabel}</span>
                        <span className={s.metaChip}>{data.batchName}</span>
                    </div>

                    {!alreadySigned && (
                        <div className={s.steps}>
                            {STEP_LABELS.map((label, i) => {
                                const n = (i + 1) as 1 | 2 | 3
                                const isDone = step > n
                                const isActive = step === n
                                return (
                                    <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : undefined }}>
                                        <div className={s.step}>
                                            <div className={`${s.stepDot} ${isDone ? s.done : ''} ${isActive ? s.active : ''}`}>
                                                {isDone ? <CheckCircle2 size={15} /> : n}
                                            </div>
                                            <span className={`${s.stepLabel} ${isActive ? s.active : ''}`}>{label}</span>
                                        </div>
                                        {i < STEP_LABELS.length - 1 && (
                                            <div className={s.stepConnector} style={{ ['--fill' as any]: isDone ? 1 : 0 }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className={s.contentWrap}>
                <div className={`${s.card} animate-fade-in`}>
                    {alreadySigned ? (
                        <div className={s.successWrap}>
                            <div className={s.checkRing}>
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12.5l5 5L20 6" />
                                </svg>
                            </div>
                            <p className={s.successTitle}>You've already signed this agreement</p>
                            {signedAtDisplay && <p className={s.successMeta}>Signed on {signedAtDisplay}</p>}
                            {displaySignature && (
                                <div className={s.signatureReceipt}>
                                    <div className={s.signatureReceiptLabel}>Signature on file</div>
                                    <div className={s.signaturePreview}>{displaySignature}</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <>
                                    <h2 className={s.panelTitle}>Read the agreement</h2>
                                    <p className={s.panelHint}>Take your time — scroll through everything before continuing.</p>

                                    <div className={s.readBox}>
                                        <div className={s.progressTrack}>
                                            <div className={s.progressFill} style={{ transform: `scaleX(${scrollPct / 100})` }} />
                                        </div>
                                        <div className={s.readScroll} ref={readScrollRef} onScroll={handleReadScroll}>
                                            {data.sections.map((sec, i) => (
                                                <div key={i} className={s.readSection}>
                                                    <h3 className={s.readHeading}>{sec.heading}</h3>
                                                    {sec.body.map((p, j) => (
                                                        <p key={j} className={s.readBody}>{p}</p>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                        <div className={s.readFadeBottom} style={{ opacity: scrollPct > 97 ? 0 : 1 }} />
                                    </div>
                                    {scrollPct > 97 && (
                                        <span className={s.readEndHint}><CheckCircle2 size={13} /> You've reached the end</span>
                                    )}

                                    <label className={`${s.agreeRow} ${agreed ? s.checked : ''}`}>
                                        <input type="checkbox" className={s.agreeCheckbox} checked={agreed} onChange={e => setAgreed(e.target.checked)} />
                                        <span className={s.agreeText}>I have read and understood the HACA Learner Agreement above, and I agree to its terms.</span>
                                    </label>

                                    {submitError && <p className={s.errorText}>{submitError}</p>}

                                    <div className={s.navRow} style={{ justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn btn-primary" onClick={goToStep2}>
                                            Continue <ArrowRight size={16} style={{ marginLeft: '0.4rem' }} />
                                        </button>
                                    </div>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <h2 className={s.panelTitle}>Your admission details</h2>
                                    <p className={s.panelHint}>We've filled in what we already know — please complete the rest.</p>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><User size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Personal Details</div>
                                        </div>
                                        <div className={s.fieldGrid}>
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
                                    </div>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><GraduationCap size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Educational Background</div>
                                        </div>
                                        <div className={s.fieldGrid}>
                                            <Field label="Highest Qualification *"><input className="input" value={form.highestQualification} onChange={setF('highestQualification')} /></Field>
                                            <Field label="Institution Name *"><input className="input" value={form.institutionName} onChange={setF('institutionName')} /></Field>
                                            <Field label="Year of Passing *"><input className="input" value={form.yearOfPassing} onChange={setF('yearOfPassing')} /></Field>
                                        </div>
                                    </div>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><BookOpen size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Course Details</div>
                                        </div>
                                        <div className={s.fieldGrid}>
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
                                    </div>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><Users size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Emergency Contact</div>
                                        </div>
                                        <div className={s.fieldGrid}>
                                            <Field label="Name *"><input className="input" value={form.emergencyContactName} onChange={setF('emergencyContactName')} /></Field>
                                            <Field label="Relationship *"><input className="input" value={form.emergencyContactRelationship} onChange={setF('emergencyContactRelationship')} /></Field>
                                            <Field label="Contact Number *"><input className="input" value={form.emergencyContactNumber} onChange={setF('emergencyContactNumber')} /></Field>
                                        </div>
                                    </div>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><CreditCard size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Payment Details</div>
                                        </div>
                                        <div className={s.fieldGrid}>
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
                                    </div>

                                    <div className={s.fieldGroup}>
                                        <div className={s.fieldGroupHead}>
                                            <div className={s.fieldGroupIcon}><Fingerprint size={16} /></div>
                                            <div className={s.fieldGroupTitle}>Identity Proof</div>
                                        </div>
                                        <div className={s.fieldGrid}>
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
                                            <Field label="Upload Copy (if online submission) *">
                                                <select className="input" value={form.uploadCopyOfIdentityProof} onChange={setF('uploadCopyOfIdentityProof')}>
                                                    <option value="">Select</option>
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </Field>
                                        </div>
                                    </div>

                                    {submitError && <p className={s.errorText}>{submitError}</p>}

                                    <div className={s.navRow}>
                                        <button type="button" className="btn btn-secondary" onClick={() => { setSubmitError(''); setStep(1) }}>
                                            <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Back
                                        </button>
                                        <button type="button" className="btn btn-primary" onClick={goToStep3}>
                                            Continue <ArrowRight size={16} style={{ marginLeft: '0.4rem' }} />
                                        </button>
                                    </div>
                                </>
                            )}

                            {step === 3 && (
                                <form onSubmit={handleSubmit}>
                                    <h2 className={s.panelTitle}>Review &amp; sign</h2>
                                    <p className={s.panelHint}>Check your details, then sign to complete your admission.</p>

                                    <div className={s.reviewGrid}>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Name</div><div className={s.reviewValue}>{form.fullName}</div></div>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Email</div><div className={s.reviewValue}>{form.email}</div></div>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Contact Number</div><div className={s.reviewValue}>{form.contactNumber}</div></div>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Course</div><div className={s.reviewValue}>{form.courseName} · {data.courseTypeLabel}</div></div>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Batch</div><div className={s.reviewValue}>{data.batchName}</div></div>
                                        <div className={s.reviewItem}><div className={s.reviewLabel}>Mode</div><div className={s.reviewValue}>{form.modeOfStudy} · {form.preferredBatchTiming}</div></div>
                                    </div>

                                    <label className={s.fieldLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>Type your full name to sign *</label>
                                    <div className={`${s.signatureBox} ${signatureName.trim() ? s.filled : ''}`}>
                                        {signatureName.trim()
                                            ? <span className={s.signaturePreview}>{signatureName}</span>
                                            : <span className={s.signaturePlaceholder}>Your signature will appear here as you type</span>}
                                    </div>
                                    <input
                                        className="input"
                                        value={signatureName}
                                        onChange={e => setSignatureName(e.target.value)}
                                        placeholder={data.studentName}
                                        autoFocus
                                    />

                                    {submitError && <p className={s.errorText}>{submitError}</p>}

                                    <div className={s.navRow}>
                                        <button type="button" className="btn btn-secondary" onClick={() => { setSubmitError(''); setStep(2) }}>
                                            <ArrowLeft size={16} style={{ marginRight: '0.4rem' }} /> Back
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                                            {submitting ? 'Submitting…' : <>Sign Agreement <PenLine size={16} style={{ marginLeft: '0.4rem' }} /></>}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
