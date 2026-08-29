import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Mail, ArrowLeft, AlertCircle } from 'lucide-react'
import styles from './page.module.css'
import { LogoRow } from './LoginPage'

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
                <div className={styles.formPanel}>
                    <div className={styles.loginCard} style={{ textAlign: 'center' }}>
                        <div className={styles.sentIcon}>
                            <Mail size={34} />
                        </div>
                        <h1 className={styles.welcomeTitle} style={{ fontSize: '28px' }}>Check your email</h1>
                        <p className={styles.subtitle}>
                            We've sent a password reset link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Click the link to set a new password — it expires in 30 minutes.
                        </p>
                        <Link to="/" className={styles.submitBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginBottom: '20px' }}>
                            Back to sign in
                        </Link>
                        <p className={styles.footerText} style={{ margin: 0 }}>Didn't get it? <a href="#" onClick={(e) => { e.preventDefault(); setSuccess(false) }}>Resend link</a></p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.container}>
            <div className={styles.formPanel}>
                <div className={styles.loginCard}>
                    <LogoRow />

                    <Link to="/" className={styles.backLink}>
                        <ArrowLeft size={15} /> Back to sign in
                    </Link>

                    <h1 className={styles.welcomeTitle}>Reset password</h1>
                    <p className={styles.subtitle}>Enter the email tied to your account and we'll send you a link to reset your password.</p>

                    {error && (
                        <div style={{ padding: '0.75rem', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: '11px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleReset} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Email address</label>
                            <div className={styles.inputWrapper}>
                                <Mail className={styles.icon} size={17} />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="you@institute.edu"
                                    className={styles.field}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Sending link...' : 'Send reset link'}
                        </button>
                    </form>

                    <p className={styles.footerText}>Remembered it? <Link to="/">Sign in</Link></p>
                </div>
            </div>
        </div>
    )
}
