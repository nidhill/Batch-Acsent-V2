import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import { Users, Mail, Phone, Building2, MapPin, ShieldCheck, Hash } from 'lucide-react'

// Matches DashboardLayout.tsx's formatRole — SALES/SALES_HEAD display as "Sales Executive"/
// "Sales Lead" everywhere else in the app (SignupPage's role picker, admission form language).
const ROLE_LABELS: Record<string, string> = { SALES: 'Sales Executive', SALES_HEAD: 'Sales Lead' }
const formatRole = (role: string) => ROLE_LABELS[role] || role.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await authedFetch('/api/auth/profile')
                const data = await res.json()
                setProfile(data.profile)
            } catch (err) {
                console.error('Error fetching profile:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    if (loading) return <div>Loading...</div>
    if (!profile) return <div style={{ padding: '2rem', textAlign: 'center' }}>Could not load your profile.</div>

    const fields = [
        { icon: Mail, label: 'Email', value: profile.email },
        { icon: Phone, label: 'Phone', value: profile.phone },
        { icon: ShieldCheck, label: 'Role', value: formatRole(profile.role) },
        { icon: Building2, label: 'School', value: profile.school },
        { icon: MapPin, label: 'Region', value: profile.region },
        { icon: Hash, label: 'Sales ID', value: profile.sales_id },
        { icon: Hash, label: 'Cliq ID', value: profile.cliq_id },
    ].filter(f => f.value)

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-dark)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Users size={28} />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>{profile.name || 'User'}</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>{formatRole(profile.role)}</p>
                </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
                {fields.map(({ icon: Icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)' }}>
                        <Icon size={18} color="var(--text-secondary)" />
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
                            <div style={{ fontWeight: 500 }}>{value}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
