import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Lock, User, Mail, Briefcase, School, ArrowLeft, AlertCircle } from 'lucide-react'
import styles from './page.module.css'
import { SCHOOLS } from '@/lib/constants'
import { API_BASE } from '@/lib/api'

// SHO/SSHO removed — their workflows now live in the SHO app, so new signups
// for those roles in Batch Ascent V2 no longer make sense.
const ALLOWED_ROLES = [
    { label: 'Sales Executive', value: 'SALES' },
    { label: 'Sales Head', value: 'SALES_HEAD' },
    { label: 'Academic Lead', value: 'ACADEMIC_LEAD' },
    { label: 'Business Head', value: 'BUSINESS_HEAD' }
]

export default function SignupPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'SALES',
        school: ''
    })
    const [loading, setLoading] = useState(false)
    const [schoolsList, setSchoolsList] = useState<any[]>([])

    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/schools`)
                const data = await res.json()
                const schools = (data.schools || []).map((s: any) => ({ ...s, id: s._id }))
                if (schools.length > 0) {
                    setSchoolsList(schools)
                    setFormData(prev => ({ ...prev, school: schools[0].name }))
                } else {
                    setSchoolsList(SCHOOLS.map(s => ({ name: s })))
                    setFormData(prev => ({ ...prev, school: SCHOOLS[0] }))
                }
            } catch (err) {
                console.error('Error fetching schools:', err)
                setSchoolsList(SCHOOLS.map(s => ({ name: s })))
            }
        }
        fetchSchools()
    }, [])

    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            // 1. Sign Up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        requested_role: formData.role,
                        school: formData.school
                    }
                }
            })

            if (authError) throw authError

            // 2. Create the Mongo profile (Status: PENDING)
            if (authData.user && authData.session) {
                const res = await fetch(`${API_BASE}/api/auth/signup-profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authData.session.access_token}` },
                    body: JSON.stringify({
                        email: formData.email,
                        name: formData.name,
                        role: formData.role,
                        school: formData.school
                    })
                })
                if (!res.ok) {
                    const data = await res.json()
                    console.error('Profile creation error:', data.error)
                }
            }

            setSuccess(true)
        } catch (err: any) {
            console.error('Signup error:', err)
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
                        <div className={styles.welcomeTitle}>Registration Successful!</div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Your account has been created and is pending approval from Admin.
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

                    <div className={styles.welcomeTitle} style={{ textAlign: 'center' }}>Create Account</div>
                    <p className={styles.subtitle} style={{ textAlign: 'center' }}>Join the Batch Ascent Team</p>
                </div>

                {error && (
                    <div style={{ padding: '0.75rem', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Full Name</label>
                        <div className={styles.inputWrapper}>
                            <User className={styles.icon} size={20} />
                            <input
                                name="name"
                                type="text"
                                placeholder="Enter your name"
                                className={`input ${styles.inputWithIcon}`}
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Email Address</label>
                        <div className={styles.inputWrapper}>
                            <Mail className={styles.icon} size={20} />
                            <input
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                className={`input ${styles.inputWithIcon}`}
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Password</label>
                        <div className={styles.inputWrapper}>
                            <Lock className={styles.icon} size={20} />
                            <input
                                name="password"
                                type="password"
                                placeholder="Create a password"
                                className={`input ${styles.inputWithIcon}`}
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Role</label>
                        <div className={styles.inputWrapper}>
                            <Briefcase className={styles.icon} size={20} />
                            <select
                                name="role"
                                className={`input ${styles.inputWithIcon}`}
                                value={formData.role}
                                onChange={handleChange}
                                required
                                style={{ background: 'transparent' }}
                            >
                                {ALLOWED_ROLES.map(role => (
                                    <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>School</label>
                        <div className={styles.inputWrapper}>
                            <School className={styles.icon} size={20} />
                            <select
                                name="school"
                                className={`input ${styles.inputWithIcon}`}
                                value={formData.school}
                                onChange={handleChange}
                                required
                                style={{ background: 'transparent' }}
                            >
                                {schoolsList.map(school => (
                                    <option key={school.id || school.name} value={school.name}>{school.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '0.5rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Creating Account...' : 'Sign Up'}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Already have an account? <Link to="/" style={{ color: 'var(--primary)', fontWeight: '600' }}>Login</Link>
                        </p>
                    </div>
                </form>
            </div>
            </div>
        </div>
    )
}
