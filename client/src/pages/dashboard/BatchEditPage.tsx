import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Save, ArrowLeft, History, Trash2 } from 'lucide-react'

export default function BatchEditPage() {
    const params = useParams<{ id: string }>()
    const id = decodeURIComponent(params.id!).trim()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState<any>(null)
    const [originalData, setOriginalData] = useState<any>(null)
    const [history, setHistory] = useState<any[]>([])
    const [showHistory, setShowHistory] = useState(false)
    const [userSchool, setUserSchool] = useState<string | null>(null)

    const [availableCourses, setAvailableCourses] = useState<any[]>([])
    const [schoolsList, setSchoolsList] = useState<any[]>([])

    const fetchCourses = async () => {
        try {
            const res = await authedFetch('/api/courses')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setAvailableCourses((data.courses || []).map((c: any) => ({ ...c, id: c._id })))
        } catch (error) {
            console.error('Error fetching courses:', error)
        }
    }

    const fetchSchools = async () => {
        try {
            const res = await authedFetch('/api/schools')
            const data = await res.json()
            setSchoolsList((data.schools || []).map((s: any) => ({ ...s, id: s._id })))
        } catch (err) {
            console.error('Error fetching schools:', err)
        }
    }

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setUserSchool(localStorage.getItem('userSchool'))
        }
        fetchBatchDetails()
        fetchHistory()
        fetchCourses()
        fetchSchools()
    }, [])

    const [availableSHOs, setAvailableSHOs] = useState<any[]>([])

    // ... (rest of imports)

    const fetchSHOs = async (school: string) => {
        try {
            const res = await authedFetch(`/api/users?directory=1&role=SHO,SSHO&school=${encodeURIComponent(school)}`)
            const data = await res.json()
            if (data.users) setAvailableSHOs(data.users)
        } catch (error) {
            console.error('Error fetching SHOs:', error)
        }
    }

    const fetchBatchDetails = async () => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setFormData(data.batch)
            setOriginalData(data.batch)
            if (data.batch.school) {
                fetchSHOs(data.batch.school)
            }
        } catch (error) {
            console.error('Error fetching batch:', error)
            alert('Failed to load batch details')
            navigate('/dashboard')
        } finally {
            setLoading(false)
        }
    }

    const fetchHistory = async () => {
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}/history`)
            const data = await res.json()
            if (data.history) setHistory(data.history)
        } catch (error) {
            console.error('Error fetching history:', error)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this batch? This action cannot be undone and will remove all student enrollments associated with this batch.')) {
            return
        }

        setSaving(true)
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to delete batch')

            alert('Batch deleted successfully')
            navigate('/dashboard')
        } catch (error: any) {
            console.error('Error deleting batch:', error)
            alert('Failed to delete batch: ' + error.message)
            setSaving(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to update batch')

            alert('Batch updated successfully!')
            navigate('/dashboard')
        } catch (error: any) {
            console.error('Error updating batch:', error)
            alert('Failed to update batch: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Loading...</div>
    if (!formData) return <div style={{ padding: '2rem', textAlign: 'center' }}>Batch not found or you do not have permission to edit it.</div>

    return (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button
                onClick={() => navigate(-1)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
                <ArrowLeft size={20} /> Back
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Edit Batch: {originalData?.name}</h2>
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <History size={18} />
                    {showHistory ? 'Hide History' : 'View History'}
                </button>
            </div>

            {showHistory && (
                <div className="card" style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>Edit History</h3>
                    {history.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)' }}>No edits recorded yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {history.map((entry) => (
                                <div key={entry.id} style={{ padding: '0.75rem', background: 'white', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: '600' }}>{entry.edited_by}</span>
                                        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                            {new Date(entry.edited_at).toLocaleString()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.875rem' }}>
                                        {Object.entries(entry.changes).map(([field, change]: [string, any]) => (
                                            <div key={field}>
                                                <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{field}:</span> {change}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label className="label">Batch Name</label>
                        <input name="name" className="input" value={formData.name} onChange={handleChange} required />
                    </div>
                    <div>
                        <label className="label">Course</label>
                        <select
                            name="course"
                            className="input"
                            value={formData.course}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Course</option>
                            {availableCourses
                                .filter(course => {
                                    if (!formData.school) return true
                                    return course.school_name === formData.school
                                })
                                .map((course) => (
                                    <option key={course.id} value={course.name}>
                                        {course.name} ({course.code})
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div>
                        <label className="label">Course Type</label>
                        <select
                            name="course_type"
                            className="input"
                            value={formData.course_type || ''}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select Course Type</option>
                            <option value="main">Main Course</option>
                            <option value="short">Short Course</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label className="label">Start Date</label>
                        <input type="date" name="start_date" className="input" value={formData.start_date} onChange={handleChange} required />
                    </div>
                    <div>
                        <label className="label">Orientation Date</label>
                        <input type="date" name="orientation_date" className="input" value={formData.orientation_date || ''} onChange={handleChange} />
                    </div>
                    <div>
                        <label className="label">Expected End Date</label>
                        <input type="date" name="end_date" className="input" value={formData.end_date || ''} onChange={handleChange} />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label className="label">Strength</label>
                        <input type="number" name="strength" className="input" value={formData.strength} onChange={handleChange} required />
                    </div>
                </div>

                <div>
                    <label className="label">SHO Name</label>
                    <select
                        name="sho_name"
                        className="input"
                        disabled={!formData.school}
                        value={formData.sho_name || ''}
                        onChange={handleChange}
                        required
                        style={!formData.school ? { background: 'var(--surface-hover)', cursor: 'not-allowed' } : {}}
                    >
                        <option value="">{formData.school ? 'Select SHO' : 'Select a School first'}</option>
                        {availableSHOs.map((sho, index) => (
                            <option key={index} value={sho.name}>{sho.name}</option>
                        ))}
                    </select>
                    {formData.school && availableSHOs.length === 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.25rem' }}>
                            No SHO found for {formData.school}.
                        </div>
                    )}
                </div>

                <div>
                    <label className="label">Mode</label>
                    <select name="mode" className="input" value={formData.mode} onChange={handleChange}>
                        <option value="Offline">Offline</option>
                        <option value="Online">Online</option>
                    </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="btn"
                        style={{ backgroundColor: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        disabled={saving}
                    >
                        <Trash2 size={20} />
                        Delete Batch
                    </button>

                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        <Save size={20} style={{ marginRight: '0.5rem' }} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}
