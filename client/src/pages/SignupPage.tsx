import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { Lock, User, Mail, Briefcase, School, Globe, ArrowLeft, AlertCircle, Eye, EyeOff, Check } from 'lucide-react'
import styles from './page.module.css'
import { SCHOOLS } from '@/lib/constants'
import { API_BASE } from '@/lib/api'
import { BrandPanel, LogoRow } from './LoginPage'

// SHO/SSHO removed — their workflows now live in the SHO app, so new signups
// for those roles in Batch Ascent V2 no longer make sense.
const ALLOWED_ROLES = [
    { label: 'Sales Executive', value: 'SALES' },
    { label: 'Sales Lead', value: 'SALES_HEAD' },
    { label: 'Academic Lead', value: 'ACADEMIC_LEAD' },
    { label: 'Business Head', value: 'BUSINESS_HEAD' }
]

export default function SignupPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        role: 'SALES',
        school: '',
        region: ''
    })
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [schoolsList, setSchoolsList] = useState<any[]>([])
    const [regionsList, setRegionsList] = useState<any[]>([])

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
        const fetchRegions = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/regions`)
                const data = await res.json()
                const regions = data.regions || []
                setRegionsList(regions)
                if (regions.length > 0) setFormData(prev => ({ ...prev, region: regions[0]._id }))
            } catch (err) {
                console.error('Error fetching regions:', err)
            }
        }
        fetchSchools()
        fetchRegions()
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
                        school: formData.school,
                        region: formData.region
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
                        school: formData.school,
                        region: formData.region
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
                <div className={styles.formPanel}>
                    <div className={styles.loginCard} style={{ textAlign: 'center' }}>
                        <div className={styles.sentIcon}>
                            <Check size={34} />
                        </div>
                        <h1 className={styles.welcomeTitle} style={{ fontSize: '28px' }}>Registration successful!</h1>
                        <p className={styles.subtitle}>Your account has been created and is pending approval from Admin.</p>
                        <Link to="/" className={styles.submitBtn} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                            Back to sign in
                        </Link>
                    </div>
                </div>
                <BrandPanel />
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

                    <h1 className={styles.welcomeTitle}>Create account</h1>
                    <p className={styles.subtitle}>Join the Batch Ascent team.</p>

                    {error && (
                        <div style={{ padding: '0.75rem', background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: '11px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', fontSize: '0.875rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Full name</label>
                            <div className={styles.inputWrapper}>
                                <User className={styles.icon} size={17} />
                                <input
                                    name="name"
                                    type="text"
                                    placeholder="Enter your name"
                                    className={styles.field}
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Email address</label>
                            <div className={styles.inputWrapper}>
                                <Mail className={styles.icon} size={17} />
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    className={styles.field}
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Password</label>
                            <div className={styles.inputWrapper}>
                                <Lock className={styles.icon} size={17} />
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Create a password"
                                    className={`${styles.field} ${styles.fieldWithToggle}`}
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)} className={styles.passwordToggle} tabIndex={-1}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Role</label>
                            <div className={styles.inputWrapper}>
                                <Briefcase className={styles.icon} size={17} />
                                <select
                                    name="role"
                                    className={`${styles.field} ${styles.selectField}`}
                                    value={formData.role}
                                    onChange={handleChange}
                                    required
                                >
                                    {ALLOWED_ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>School</label>
                            <div className={styles.inputWrapper}>
                                <School className={styles.icon} size={17} />
                                <select
                                    name="school"
                                    className={`${styles.field} ${styles.selectField}`}
                                    value={formData.school}
                                    onChange={handleChange}
                                    required
                                >
                                    {schoolsList.map(school => (
                                        <option key={school.id || school.name} value={school.name}>{school.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.inputGroup}>
                            <label className={styles.label} style={{ display: 'block', marginBottom: '7px' }}>Region</label>
                            <div className={styles.inputWrapper}>
                                <Globe className={styles.icon} size={17} />
                                <select
                                    name="region"
                                    className={`${styles.field} ${styles.selectField}`}
                                    value={formData.region}
                                    onChange={handleChange}
                                    required
                                >
                                    {regionsList.map(region => (
                                        <option key={region._id} value={region._id}>{region.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button type="submit" className={styles.submitBtn} disabled={loading}>
                            {loading ? 'Creating account...' : 'Sign up'}
                        </button>
                    </form>

                    <p className={styles.footerText}>Already have an account? <Link to="/">Login</Link></p>
                </div>
            </div>

            <BrandPanel />
        </div>
    )
}
