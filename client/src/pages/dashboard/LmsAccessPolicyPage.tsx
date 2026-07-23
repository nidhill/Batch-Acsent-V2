import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import { ShieldCheck } from 'lucide-react'

const RULE_OPTIONS = [
    { value: 'any_payment', label: 'Any payment received', help: 'Student gets LMS access as soon as any amount is paid.' },
    { value: 'min_percentage', label: 'Minimum % of fee paid', help: 'Student gets LMS access once a configurable percentage of the final fee is paid.' },
    { value: 'full_payment', label: 'Full payment only', help: 'Student gets LMS access only once the entire final fee is cleared.' },
]

export default function LmsAccessPolicyPage() {
    const [policy, setPolicy] = useState<{ rule_type: string; min_percentage: number } | null>(null)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const load = async () => {
            try {
                const res = await authedFetch('/api/settings/lms-access-policy')
                const data = await res.json()
                if (res.ok) setPolicy(data.policy)
            } catch (err) {
                console.error('Error loading LMS access policy:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const save = async () => {
        if (!policy) return
        setSaving(true)
        try {
            const res = await authedFetch('/api/settings/lms-access-policy', {
                method: 'PUT',
                body: JSON.stringify(policy),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            alert('LMS access policy updated.')
        } catch (err: any) {
            alert('Error saving policy: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading || !policy) return <div className="animate-pulse">Loading...</div>

    return (
        <div className="animate-fade-in" style={{ maxWidth: '640px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} /> LMS Access Policy
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Controls when an onboarded student's payment status grants them LMS access. Exact rule is a management decision — configure it here instead of hardcoding it.
            </p>

            <div className="card" style={{ display: 'grid', gap: '1rem' }}>
                {RULE_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer', padding: '0.75rem', borderRadius: '0.5rem', background: policy.rule_type === opt.value ? 'var(--surface-hover)' : 'transparent' }}>
                        <input
                            type="radio"
                            name="rule_type"
                            checked={policy.rule_type === opt.value}
                            onChange={() => setPolicy({ ...policy, rule_type: opt.value })}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <div>
                            <div style={{ fontWeight: 600 }}>{opt.label}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{opt.help}</div>
                        </div>
                    </label>
                ))}

                {policy.rule_type === 'min_percentage' && (
                    <div style={{ paddingLeft: '2rem' }}>
                        <label className="block mb-1 text-sm font-medium">Minimum % of fee paid</label>
                        <input
                            type="number"
                            className="input"
                            min={0}
                            max={100}
                            value={policy.min_percentage}
                            onChange={(e) => setPolicy({ ...policy, min_percentage: parseFloat(e.target.value) || 0 })}
                            style={{ maxWidth: '150px' }}
                        />
                    </div>
                )}

                <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: '0.5rem', width: 'fit-content' }}>
                    {saving ? 'Saving...' : 'Save Policy'}
                </button>
            </div>
        </div>
    )
}
