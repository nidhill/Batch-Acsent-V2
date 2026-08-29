import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, AlertCircle, Phone, ArrowRight, Eye, EyeOff } from 'lucide-react'
import styles from './page.module.css'
import { supabase } from '@/lib/supabaseClient'
import { API_BASE } from '@/lib/api'

// Shared logo row across Login/Signup/ForgotPassword — kept as a local component here
// (rather than a separate file) since only these three pages use it.
export function LogoRow() {
  return (
    <div className={styles.brandRow}>
      <div className={styles.logoBadge}>
        <img src="/logo-new.png" alt="Batch Ascent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <span className={styles.logoWordmark}>Batch Ascent</span>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // authedFetch (lib/api.ts) redirects here with ?sessionExpired=1 when the Supabase refresh
  // token has died and every API call started 401ing — surfaces as a plain re-login prompt
  // instead of the dashboard silently hanging on stale/empty data.
  const [error, setError] = useState(() =>
    new URLSearchParams(window.location.search).get('sessionExpired') ? 'Your session expired. Please sign in again.' : ''
  )
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Sales and Sales Head have no Overview nav item — Overview's admin-level BI (company
  // revenue, sales-team-wide performance) isn't meant for individual reps, and Sales Head
  // has nothing actionable left there either (see ProjectOverview.tsx). Send each straight
  // to their real home page instead of dropping them on a page with no way back from the sidebar.
  const defaultRouteForRole = (role: string) => {
    if (role === 'SALES_HEAD') return '/dashboard/verification-queue'
    if (role === 'SALES') return '/dashboard/sales'
    return '/dashboard'
  }

  const completeLogin = async (accessToken: string, phone?: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(phone ? { phone } : {})
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    return data
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) {
        throw authError
      }

      // 2. Fetch/complete the Mongo profile
      if (authData.user && authData.session) {
        let data
        try {
          data = await completeLogin(authData.session.access_token)
        } catch (completeLoginErr) {
          // A deactivated account (or any other server-side rejection) shouldn't leave a
          // stale Supabase session sitting in the browser — same cleanup as the "pending
          // approval" case below.
          await supabase.auth.signOut()
          throw completeLoginErr
        }

        if (data.pending) {
          await supabase.auth.signOut()
          throw new Error('Waiting for approval from Admin.')
        }

        if (data.needs_phone) {
          setShowPhoneInput(true)
          setLoading(false)
          return
        }

        const userData = data.profile
        localStorage.setItem('userRole', userData.role)
        localStorage.setItem('userName', userData.name)
        if (userData.school) localStorage.setItem('userSchool', userData.school)
        else localStorage.removeItem('userSchool')

        if (userData.sales_id) localStorage.setItem('salesId', userData.sales_id)
        else localStorage.removeItem('salesId')

        navigate(defaultRouteForRole(userData.role))
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid credentials')
      setLoading(false)
    }
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber) {
      setError('Phone number is required')
      return
    }
    setLoading(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired — please log in again')

      const data = await completeLogin(session.access_token, phoneNumber)
      const userData = data.profile

      localStorage.setItem('userRole', userData.role)
      localStorage.setItem('userName', userData.name)
      if (userData.school) localStorage.setItem('userSchool', userData.school)
      localStorage.setItem('salesId', userData.sales_id)

      navigate(defaultRouteForRole(userData.role))

    } catch (err: any) {
      console.error('Phone update error:', err)
      setError(err.message || 'Failed to update phone number')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.formPanel}>
        <div className={styles.loginCard}>
          <LogoRow />

          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '11px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {showPhoneInput ? (
            <form onSubmit={handlePhoneSubmit} className={styles.form}>
              <p className={styles.subtitle} style={{ marginBottom: '18px' }}>Please verify your phone number to generate your Sales ID.</p>

              <div className={styles.inputGroup}>
                <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Phone number</label>
                <div className={styles.inputWrapper}>
                  <Phone className={styles.icon} />
                  <input
                    type="tel"
                    className={styles.field}
                    placeholder="Enter phone number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {loading ? 'Generating Sales ID...' : 'Complete Setup'} <ArrowRight size={16} />
              </button>

              <button type="button" onClick={() => setShowPhoneInput(false)} className={styles.backLink} style={{ justifyContent: 'center', marginTop: '20px', marginBottom: 0, background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                Back to sign in
              </button>
            </form>
          ) : (
            <>
              <h1 className={styles.welcomeTitle}>Welcome back</h1>
              <p className={styles.subtitle}>Sign in to your Batch Ascent account.</p>

              <form onSubmit={handleLogin} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Email address</label>
                  <div className={styles.inputWrapper}>
                    <Mail className={styles.icon} />
                    <input
                      type="email"
                      className={styles.field}
                      placeholder="you@institute.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label}>Password</label>
                    <Link to="/forgot-password" className={styles.forgotLink}>Forgot password?</Link>
                  </div>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.icon} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`${styles.field} ${styles.fieldWithToggle}`}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className={styles.passwordToggle} tabIndex={-1}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <label className={styles.checkboxRow}>
                  <input type="checkbox" />
                  <span>Keep me signed in</span>
                </label>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <p className={styles.footerText}>Don't have an account? <Link to="/signup">Create one</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
