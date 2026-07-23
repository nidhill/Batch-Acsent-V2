import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { AlertCircle, Mail } from 'lucide-react'

// Ported from src/app/auth/callback/page.tsx. The original's `export const dynamic =
// 'force-dynamic'` was a Next.js runtime directive with no equivalent (or need) in a
// client-rendered SPA — dropped.
export default function AuthCallbackPage() {
    const navigate = useNavigate()
    const [error, setError] = useState<string | null>(null)
    const [resendEmail, setResendEmail] = useState('')
    const [resendLoading, setResendLoading] = useState(false)
    const [resendSent, setResendSent] = useState(false)

    useEffect(() => {
        const handleCallback = async () => {
            const hash = window.location.hash
            const search = window.location.search
            const params = new URLSearchParams(search)
            const hashParams = new URLSearchParams(hash.substring(1))

            // Check for errors in hash (implicit flow errors)
            if (hash && (hashParams.get('error') || hashParams.get('error_code'))) {
                setError(hashParams.get('error_description')?.replace(/\+/g, ' ') || 'Link expired or invalid')
                return
            }

            // PKCE flow: exchange code for session
            const code = params.get('code')
            if (code) {
                const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
                if (exchangeError) {
                    setError(exchangeError.message)
                    return
                }
                navigate('/update-password')
                return
            }

            // Implicit flow fallback: listen for SIGNED_IN
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
                if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                    navigate('/update-password')
                }
            })

            return () => { subscription.unsubscribe() }
        }

        handleCallback()
    }, [navigate])

    const handleResend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!resendEmail) return
        setResendLoading(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
                redirectTo: `${window.location.origin}/auth/callback`
            })
            if (error) throw error
            setResendSent(true)
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setResendLoading(false)
        }
    }

    if (error) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: 'var(--background)',
                padding: '2rem'
            }}>
                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <div style={{
                            width: '48px', height: '48px',
                            background: '#fee2e2', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1rem'
                        }}>
                            <AlertCircle size={24} color="#ef4444" />
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Link Expired</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            This link has expired or already been used.<br />
                            Enter your email to get a fresh link.
                        </p>
                    </div>

                    {resendSent ? (
                        <div style={{
                            textAlign: 'center', padding: '1.25rem',
                            background: '#f0fdf4', borderRadius: '0.75rem',
                            border: '1px solid #bbf7d0', color: '#15803d'
                        }}>
                            <Mail size={22} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                            <p style={{ fontWeight: 600 }}>New link sent!</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: '#166534' }}>
                                Check your inbox and click the <strong>latest</strong> email only.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                                    Your Email
                                </label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="you@example.com"
                                    required
                                    value={resendEmail}
                                    onChange={e => setResendEmail(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={resendLoading}>
                                {resendLoading ? 'Sending...' : 'Send New Link'}
                            </button>
                        </form>
                    )}

                    <button
                        onClick={() => navigate('/')}
                        className="btn btn-secondary"
                        style={{ width: '100%', marginTop: '0.75rem' }}
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'var(--background)'
        }}>
            <div className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>Verifying your account...</div>
        </div>
    )
}
