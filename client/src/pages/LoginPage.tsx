import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Lock, User, AlertCircle, Phone, ArrowRight } from 'lucide-react'
import styles from './page.module.css'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPhoneInput, setShowPhoneInput] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const completeLogin = async (accessToken: string, phone?: string) => {
    const res = await fetch('/api/auth/login', {
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

        navigate('/dashboard')
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

      navigate('/dashboard')

    } catch (err: any) {
      console.error('Phone update error:', err)
      setError(err.message || 'Failed to update phone number')
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      {/* Brand panel — hidden on narrow viewports, see .brandPanel in page.module.css */}
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
          <div className={styles.header}>
            <div className={styles.mobileLogoBadge}>
              <img src="/logo-new.png" alt="Batch Ascent" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div className={styles.welcomeTitle}>Welcome back</div>
            <p className={styles.subtitle}>Sign in to your Batch Ascent account</p>
          </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {showPhoneInput ? (
          <form onSubmit={handlePhoneSubmit} className={styles.form}>
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-500 mb-2">Please verify your phone number to generate your Sales ID.</p>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>Phone Number</label>
              <div className={styles.inputWrapper}>
                <Phone className={styles.icon} />
                <input
                  type="tel"
                  className={`input ${styles.inputWithIcon}`}
                  placeholder="Enter phone number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Generating Sales ID...' : 'Complete Setup'} <ArrowRight size={16} style={{ marginLeft: '8px' }} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button type="button" onClick={() => { setShowPhoneInput(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className={styles.form}>


            <div className={styles.inputGroup}>
              <label className={styles.label}>Email Address</label>
              <div className={styles.inputWrapper}>
                <User className={styles.icon} />
                <input
                  type="email"
                  className={`input ${styles.inputWithIcon}`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className={styles.label} style={{ marginBottom: 0 }}>Password</label>
                <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}>Forgot Password?</Link>
              </div>
              <div className={styles.inputWrapper}>
                <Lock className={styles.icon} />
                <input
                  type="password"
                  className={`input ${styles.inputWithIcon}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Don't have an account? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>Sign Up</Link>
              </p>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}
