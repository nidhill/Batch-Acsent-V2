import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { UserPlus, Phone, Mail, Pencil, Trash2 } from 'lucide-react'
import { LEAD_SOURCES } from '@/lib/constants'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    new: { bg: 'var(--info-light)', color: 'var(--info)' },
    contacted: { bg: 'var(--warning-light)', color: 'var(--warning)' },
    converted: { bg: 'var(--success-light)', color: 'var(--success)' },
    lost: { bg: 'var(--secondary-light)', color: 'var(--text-secondary)' },
}

export default function LeadsPage() {
    const navigate = useNavigate()
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({ name: '', phone: '', email: '', lead_source: '', interested_course: '', notes: '' })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', lead_source: '', interested_course: '' })
    const [savingEdit, setSavingEdit] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const res = await authedFetch('/api/leads')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setLeads(data.leads || [])
        } catch (err) {
            console.error('Error fetching leads:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchLeads() }, [])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await authedFetch('/api/leads', {
                method: 'POST',
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setForm({ name: '', phone: '', email: '', lead_source: '', interested_course: '', notes: '' })
            setShowForm(false)
            fetchLeads()
        } catch (err: any) {
            alert('Error creating lead: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const updateStatus = async (id: string, status: string) => {
        try {
            const res = await authedFetch(`/api/leads/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            fetchLeads()
        } catch (err: any) {
            alert('Error updating lead: ' + err.message)
        }
    }

    const startEdit = (lead: any) => {
        setEditingId(lead.id)
        setEditForm({
            name: lead.name || '', phone: lead.phone || '', email: lead.email || '',
            lead_source: lead.lead_source || '', interested_course: lead.interested_course || '',
        })
    }

    const handleUpdate = async (e: React.FormEvent, id: string) => {
        e.preventDefault()
        setSavingEdit(true)
        try {
            const res = await authedFetch(`/api/leads/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(editForm),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setEditingId(null)
            fetchLeads()
        } catch (err: any) {
            alert('Error updating lead: ' + err.message)
        } finally {
            setSavingEdit(false)
        }
    }

    const handleDelete = async (lead: any) => {
        if (!confirm(`Delete lead "${lead.name}"? This cannot be undone.`)) return
        setDeletingId(lead.id)
        try {
            const res = await authedFetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            fetchLeads()
        } catch (err: any) {
            alert('Error deleting lead: ' + err.message)
        } finally {
            setDeletingId(null)
        }
    }

    const convertToAdmission = (lead: any) => {
        const params = new URLSearchParams({
            lead_id: lead.id,
            student_name: lead.name || '',
            contact_number: lead.phone || '',
            email: lead.email || '',
            lead_source: lead.lead_source || '',
        })
        navigate(`/dashboard/sales/intimation?${params.toString()}`)
    }

    const filtered = statusFilter === 'ALL' ? leads : leads.filter(l => l.status === statusFilter)

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserPlus size={22} /> Leads
                </h2>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : 'New Lead'}
                </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Log a prospective student before they're formally admitted — convert them to a Student Admission once counselling is complete.
            </p>

            {showForm && (
                <form onSubmit={handleCreate} className="card" style={{ marginBottom: '1.5rem', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <input className="input" placeholder="Name *" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                    <input className="input" placeholder="Phone *" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                    <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    <select className="input" value={form.lead_source} onChange={e => setForm({ ...form, lead_source: e.target.value })}>
                        <option value="">Lead Source</option>
                        {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <input className="input" placeholder="Interested Course" value={form.interested_course} onChange={e => setForm({ ...form, interested_course: e.target.value })} />
                    <input className="input" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ gridColumn: '1 / -1' }}>
                        {saving ? 'Saving...' : 'Save Lead'}
                    </button>
                </form>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {['ALL', 'new', 'contacted', 'converted', 'lost'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} style={{ textTransform: 'capitalize' }}>
                        {s}
                    </button>
                ))}
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No leads found.</div>
                ) : (
                    filtered.map((lead, i) => {
                        const sc = STATUS_COLORS[lead.status] || STATUS_COLORS.new
                        if (editingId === lead.id) {
                            return (
                                <form key={lead.id} onSubmit={e => handleUpdate(e, lead.id)} style={{ padding: '1rem 1.5rem', borderBottom: i !== filtered.length - 1 ? '1px solid var(--border)' : 'none', display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', background: 'var(--surface-hover)' }}>
                                    <input className="input" placeholder="Name *" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                                    <input className="input" placeholder="Phone *" required value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                    <input className="input" type="email" placeholder="Email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                    <select className="input" value={editForm.lead_source} onChange={e => setEditForm({ ...editForm, lead_source: e.target.value })}>
                                        <option value="">Lead Source</option>
                                        {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    <input className="input" placeholder="Interested Course" value={editForm.interested_course} onChange={e => setEditForm({ ...editForm, interested_course: e.target.value })} />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button type="submit" className="btn btn-primary" disabled={savingEdit} style={{ fontSize: '0.8rem' }}>{savingEdit ? 'Saving...' : 'Save'}</button>
                                        <button type="button" className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                                    </div>
                                </form>
                            )
                        }
                        return (
                            <div key={lead.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: i !== filtered.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{lead.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Phone size={12} /> {lead.phone}</span>
                                        {lead.email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} /> {lead.email}</span>}
                                        {lead.lead_source && <span>{lead.lead_source}</span>}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                                        {lead.status}
                                    </span>
                                    {lead.status === 'new' && (
                                        <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => updateStatus(lead.id, 'contacted')}>Mark Contacted</button>
                                    )}
                                    {lead.status !== 'converted' && lead.status !== 'lost' && (
                                        <>
                                            <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => convertToAdmission(lead)}>Convert to Admission</button>
                                            <button className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }} onClick={() => updateStatus(lead.id, 'lost')}>Mark Lost</button>
                                        </>
                                    )}
                                    <button className="btn btn-secondary" title="Edit" style={{ padding: '0.35rem 0.5rem' }} onClick={() => startEdit(lead)}>
                                        <Pencil size={14} />
                                    </button>
                                    {lead.status !== 'converted' && (
                                        <button className="btn btn-secondary" title="Delete" style={{ padding: '0.35rem 0.5rem', color: 'var(--error)' }} disabled={deletingId === lead.id} onClick={() => handleDelete(lead)}>
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
