import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { API_BASE } from '@/lib/api'
import { Lock, Phone, AlertCircle, Mail } from 'lucide-react'

export default function UpdatePasswordPage() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [needsPhone, setNeedsPhone] = useState(false)
    const [linkExpired, setLinkExpired] = useState(false)
    const [resendEmail, setResendEmail] = useState('')
    const [resendLoading, setResendLoading] = useState(false)
    const [resendSent, setResendSent] = useState(false)

    useEffect(() => {
        // Check for error in URL hash (e.g. otp_expired)
        const hash = window.location.hash
        if (hash && hash.includes('error')) {
            const params = new URLSearchParams(hash.substring(1))
            const errorCode = params.get('error_code')
            if (errorCode === 'otp_expired' || params.get('error') === 'access_denied') {
                setLinkExpired(true)
                return
            }
        }

        const loadProfile = async (accessToken: string) => {
            try {
                const res = await fetch(`${API_BASE}/api/auth/profile`, { headers: { 'Authorization': `Bearer ${accessToken}` } })
                const data = await res.json()
                if (res.ok && data.profile) {
                    if (data.profile.role === 'SALES' && !data.profile.sales_id) {
                        setNeedsPhone(true)
                    }
                }
            } catch (err) {
                console.error('Error loading profile:', err)
            }
        }

        // Listen for auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.access_token) {
                await loadProfile(session.access_token)
            }
        })

        // Also check existing session
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) await loadProfile(session.access_token)
        }
        init()

        return () => subscription.unsubscribe()
    }, [])

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error

            if (needsPhone && phone) {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) {
                    const res = await fetch(`${API_BASE}/api/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                        body: JSON.stringify({ phone })
                    })
                    if (!res.ok) {
                        const data = await res.json()
                        console.error('Error assigning sales ID:', data.error)
                    }
                }
            }

            alert('Password updated successfully!')
            navigate('/')
        } catch (error: any) {
            alert('Error updating password: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleResendLink = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!resendEmail) return
        setResendLoading(true)
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resendEmail, {
                redirectTo: `${window.location.origin}/auth/callback`
            })
            if (error) throw error
            setResendSent(true)
        } catch (error: any) {
            alert('Error sending reset link: ' + error.message)
        } finally {
            setResendLoading(false)
        }
    }

    // ── Link Expired UI ──
    if (linkExpired) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--background)'
            }}>
                <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
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
                            This password reset link has expired or is invalid.<br />Enter your email to get a new one.
                        </p>
                    </div>

                    {resendSent ? (
                        <div style={{
                            textAlign: 'center', padding: '1rem',
                            background: '#f0fdf4', borderRadius: '0.75rem',
                            border: '1px solid #bbf7d0', color: '#15803d'
                        }}>
                            <Mail size={20} style={{ margin: '0 auto 0.5rem' }} />
                            <p style={{ fontWeight: 600 }}>New link sent!</p>
                            <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Check your email inbox.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleResendLink} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                {resendLoading ? 'Sending...' : 'Request New Link'}
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

    // ── Set Password UI ──
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)'
        }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '48px', height: '48px',
                        background: 'var(--primary)', borderRadius: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1rem', color: 'white'
                    }}>
                        <Lock size={24} />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Set New Password</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Enter your new password below.</p>
                </div>

                <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>New Password</label>
                        <input
                            type="password"
                            className="input"
                            placeholder="••••••••"
                            required
                            minLength={6}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    {needsPhone && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                                Phone Number (Required for Sales ID)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                <input
                                    type="tel"
                                    className="input"
                                    placeholder="+1234567890"
                                    required
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Updating...' : 'Set Password'}
                    </button>
                </form>
            </div>
        </div>
    )
}
