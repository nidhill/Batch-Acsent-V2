import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react'
import styles from './page.module.css'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            })

            if (error) throw error

            setSuccess(true)
        } catch (err: any) {
            console.error('Reset error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className={styles.container}>
                <div className={styles.brandPanel}>
                    <div className={styles.brandLogoBadge}>
                        <img src="/logo-new.png" alt="Batch Ascent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div className={styles.brandName}>Batch Ascent</div>
                    <p className={styles.brandTagline}>
                        One place to manage admissions, batches, payments and every student's journey from lead to onboarding.
                    </p>
                </div>
                <div className={styles.formPanel}>
                    <div className={`card ${styles.loginCard} animate-fade-in`} style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                        </div>
                        <div className={styles.welcomeTitle}>Check your email</div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            We've sent a password reset link to <strong>{email}</strong>.
                        </p>
                        <Link to="/" className="btn btn-primary" style={{ display: 'inline-block', width: '100%' }}>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.brandPanel}>
                <div className={styles.brandLogoBadge}>
                    <img src="/logo-new.png" alt="Batch Ascent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div className={styles.brandName}>Batch Ascent</div>
                <p className={styles.brandTagline}>
                    One place to manage admissions, batches, payments and every student's journey from lead to onboarding.
                </p>
                <div className={styles.brandFeatures}>
                    <div className={styles.brandFeature}><span className={styles.brandFeatureDot} /> Role-based dashboards for every department</div>
                    <div className={styles.brandFeature}><span className={styles.brandFeatureDot} /> Real-time revenue &amp; admissions analytics</div>
                    <div className={styles.brandFeature}><span className={styles.brandFeatureDot} /> End-to-end student lifecycle tracking</div>
                </div>
            </div>
            <div className={styles.formPanel}>
            <div className={`card ${styles.loginCard} animate-fade-in`}>
                <div className={styles.header} style={{ position: 'relative' }}>
                    <Link to="/" style={{ position: 'absolute', left: 0, top: 0, color: 'var(--text-secondary)' }}>
                        <ArrowLeft size={20} />
                    </Link>

                    <div className={styles.mobileLogoBadge}>
                        <img src="/logo-new.png" alt="Batch Ascent Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>

                    <div className={styles.welcomeTitle} style={{ textAlign: 'center' }}>Reset Password</div>
                    <p className={styles.subtitle} style={{ textAlign: 'center' }}>Enter your email to receive instructions</p>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleReset} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Email Address</label>
                        <div className={styles.inputWrapper}>
                            <Mail className={styles.icon} size={20} />
                            <input
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                className={`input ${styles.inputWithIcon}`}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Sending Link...' : 'Send Reset Link'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Remember password? <Link to="/" style={{ color: 'var(--primary)', fontWeight: '600' }}>Login</Link>
                        </p>
                    </div>
                </form>
            </div>
            </div>
        </div>
    )
}
