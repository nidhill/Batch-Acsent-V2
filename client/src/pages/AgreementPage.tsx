import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { API_BASE } from '@/lib/api'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface AgreementSection {
    heading: string
    body: string[]
}

interface AgreementData {
    studentName: string
    batchName: string
    courseTypeLabel: string
    sections: AgreementSection[]
    status: 'sent' | 'opened' | 'signed'
    signedAt: string | null
    signatureName: string | null
}

export default function AgreementPage() {
    const { admissionId } = useParams<{ admissionId: string }>()
    const [data, setData] = useState<AgreementData | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [agreed, setAgreed] = useState(false)
    const [signatureName, setSignatureName] = useState('')
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
            })
            .catch(err => setLoadError(err.message || 'Failed to load agreement'))
            .finally(() => setLoading(false))
    }, [admissionId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitError('')
        if (!agreed) { setSubmitError('Please confirm you have read and agree to the terms above.'); return }
        if (!signatureName.trim()) { setSubmitError('Please type your full name to sign.'); return }

        setSubmitting(true)
        try {
            const res = await fetch(`${API_BASE}/api/learner-agreements/public/${admissionId}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signatureName: signatureName.trim() }),
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

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
