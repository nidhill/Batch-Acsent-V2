import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Plus, Trash2, School, BookOpen } from 'lucide-react'

// Routed outside AdminGate (see App.tsx) so Academic Lead can reach this page without also
// getting Manage Users/Approve Users/Activity Logs — guards itself the same way AdminGate does.
const ALLOWED_ROLES = ['ADMIN', 'CEO', 'BUSINESS_HEAD', 'ACADEMIC_LEAD']

export default function SchoolsPage() {
    const navigate = useNavigate()
    const [authorized, setAuthorized] = useState(false)
    const [schools, setSchools] = useState<any[]>([])
    const [courses, setCourses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [newSchool, setNewSchool] = useState<{ name: string, code: string }>({ name: '', code: '' })
    const [newCourse, setNewCourse] = useState<{ name: string, code: string, school_name: string, regions: string }>({ name: '', code: '', school_name: '', regions: '' })

    const [userRole, setUserRole] = useState<string | null>(null)
    // Course management (add/edit/delete/toggle) is also open to Academic Lead — they're the
    // ones creating batches and hitting "the course I need isn't in the list" most often.
    // School management (a much rarer, more structural change) stays Admin-only.
    const canManageCourses = ['ADMIN', 'ACADEMIC_LEAD'].includes(userRole || '')

    const [analytics, setAnalytics] = useState<any>(null)

    useEffect(() => {
        const storedRole = localStorage.getItem('userRole')
        if (!ALLOWED_ROLES.includes(storedRole || '')) {
            navigate('/dashboard')
            return
        }
        setAuthorized(true)
        setUserRole(storedRole)
        fetchSchools()
        fetchCourses()
        fetchAnalytics()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchAnalytics = async () => {
        try {
            const res = await authedFetch('/api/analytics/overview')
            const data = await res.json()
            if (res.ok) setAnalytics(data)
        } catch (error) {
            console.error('Error fetching school/course analytics:', error)
        }
    }

    const fetchSchools = async () => {
        try {
            const res = await authedFetch('/api/schools')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setSchools((data.schools || []).map((s: any) => ({ ...s, id: s._id })))
        } catch (error) {
            console.error('Error fetching schools:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchCourses = async () => {
        try {
            const res = await authedFetch('/api/courses')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setCourses((data.courses || []).map((c: any) => ({ ...c, id: c._id })))
        } catch (error) {
            console.error('Error fetching courses:', error)
        }
    }

    const handleAddSchool = async (e: React.FormEvent) => {
        e.preventDefault()
        if (userRole !== 'ADMIN') return alert('Only admins can add schools')
        try {
            const res = await authedFetch('/api/schools', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSchool.name, code: newSchool.code })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setNewSchool({ name: '', code: '' })
            fetchSchools()
            alert('School added successfully!')
        } catch (error: any) {
            alert('Error adding school: ' + error.message)
        }
    }

    const handleAddCourse = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!canManageCourses) return alert('Only admins and academic leads can add courses')
        try {
            const res = await authedFetch('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newCourse,
                    regions: newCourse.regions.split(',').map(r => r.trim()).filter(Boolean),
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setNewCourse({ name: '', code: '', school_name: '', regions: '' })
            fetchCourses()
            alert('Course added successfully!')
        } catch (error: any) {
            alert('Error adding course: ' + error.message)
        }
    }

    const handleToggleCourseActive = async (course: any) => {
        try {
            const res = await authedFetch(`/api/courses/${course.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !course.is_active })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            fetchCourses()
        } catch (error: any) {
            alert('Error updating course: ' + error.message)
        }
    }

    const handleDeleteCourse = async (id: string) => {
        if (!canManageCourses) return alert('Only admins and academic leads can delete courses')
        if (!confirm('Are you sure you want to delete this course?')) return

        try {
            const res = await authedFetch(`/api/courses/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            fetchCourses()
        } catch (error: any) {
            alert('Error deleting course: ' + error.message)
        }
    }

    const handleDeleteSchool = async (id: string) => {
        if (userRole !== 'ADMIN') return alert('Only admins can delete schools')
        if (!confirm('Are you sure? This might affect existing batches.')) return

        try {
            const res = await authedFetch(`/api/schools/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            fetchSchools()
        } catch (error: any) {
            alert('Error deleting school: ' + error.message)
        }
    }

    const [editingCourse, setEditingCourse] = useState<any>(null)

    const handleUpdateCourse = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await authedFetch(`/api/courses/${editingCourse.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editingCourse.name,
                    code: editingCourse.code,
                    school_name: editingCourse.school_name
                })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setEditingCourse(null)
            fetchCourses()
            alert('Course updated successfully!')
        } catch (error: any) {
            alert('Error updating course: ' + error.message)
        }
    }

    if (!authorized) return null

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <School /> Manage Schools
            </h2>

            {/* Add School Form - ADMIN ONLY */}
            {userRole === 'ADMIN' && (
                <div className="card mb-8" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Add New School</h3>
                    <form onSubmit={handleAddSchool} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <input
                            type="text"
                            placeholder="School Name (e.g. AI School)"
                            className="input"
                            value={newSchool.name}
                            onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Code (e.g. AI)"
                            className="input"
                            value={newSchool.code}
                            onChange={e => setNewSchool({ ...newSchool, code: e.target.value.toUpperCase() })}
                            required
                            maxLength={3}
                        />
                        <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>
                            <Plus size={20} style={{ marginRight: '0.5rem' }} />
                            Add School
                        </button>
                    </form>
                </div>
            )}

            {/* Schools List */}
            <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Existing Schools</h3>

                {loading ? (
                    <div className="animate-pulse">Loading schools...</div>
                ) : schools.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No schools found in the "schools" table.
                        <div style={{ marginTop: '1rem', fontSize: '0.875rem', background: 'var(--warning-light)', color: 'var(--warning)', padding: '0.5rem', borderRadius: '4px' }}>
                            ⚠️ Ensure you have created the "schools" table in Supabase.
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {schools.map(school => (
                            <div key={school.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: 'var(--surface-hover)',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border)'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>{school.name}</div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'flex', gap: '1rem' }}>
                                        <span>Code: {school.code || '—'}</span>
                                    </div>
                                    {analytics && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.375rem', display: 'flex', gap: '1rem' }}>
                                            <span>{analytics.batches_by_school?.[school.name] || 0} batches</span>
                                            <span>{analytics.admissions_by_school?.[school.name] || 0} admissions</span>
                                            {analytics.revenue_by_school?.[school.name] !== undefined && (
                                                <span>₹{(analytics.revenue_by_school[school.name] || 0).toLocaleString()} collected</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {userRole === 'ADMIN' && (
                                    <button
                                        onClick={() => handleDeleteSchool(school.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                        title="Delete School"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <hr style={{ margin: '3rem 0', border: '0', borderTop: '1px solid var(--border)' }} />

            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                < BookOpen /> Manage Courses
            </h2>

            {/* Add Course Form - Admin and Academic Lead */}
            {canManageCourses && (
                <div className="card mb-8" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Add New Course</h3>
                    <form onSubmit={handleAddCourse} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <select
                            className="input"
                            value={newCourse.school_name}
                            onChange={e => setNewCourse({ ...newCourse, school_name: e.target.value })}
                            required
                            style={{ padding: '0.5rem' }}
                        >
                            <option value="">Select School</option>
                            {schools.map(school => (
                                <option key={school.id} value={school.name}>
                                    {school.name}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Course Name (e.g. Applied AI)"
                            className="input"
                            value={newCourse.name}
                            onChange={e => setNewCourse({ ...newCourse, name: e.target.value })}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Code (e.g. AA)"
                            className="input"
                            value={newCourse.code}
                            onChange={e => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                            required
                            maxLength={5}
                        />
                        <input
                            type="text"
                            placeholder="Regions (e.g. India, UAE) — blank = all"
                            className="input"
                            value={newCourse.regions}
                            onChange={e => setNewCourse({ ...newCourse, regions: e.target.value })}
                        />
                        <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>
                            <Plus size={20} style={{ marginRight: '0.5rem' }} />
                            Add Course
                        </button>
                    </form>
                </div>
            )}

            {/* Courses List */}
            <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Existing Courses</h3>

                {courses.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No courses found.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {courses.map(course => (
                            <div key={course.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: 'var(--surface-hover)',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border)'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {course.name}
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: '999px',
                                            background: course.is_active === false ? 'var(--secondary-light)' : 'var(--success-light)',
                                            color: course.is_active === false ? 'var(--text-secondary)' : 'var(--success)',
                                        }}>
                                            {course.is_active === false ? 'Inactive' : 'Active'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                        School: {course.school_name} | Code: {course.code}
                                        {course.regions?.length > 0 && ` | Regions: ${course.regions.join(', ')}`}
                                    </div>
                                    {analytics && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.375rem', display: 'flex', gap: '1rem' }}>
                                            <span>{analytics.batches_by_course?.[course.name] || 0} batches</span>
                                            <span>{analytics.admissions_by_course?.[course.name] || 0} admissions</span>
                                            {analytics.revenue_by_course?.[course.name] !== undefined && (
                                                <span>₹{(analytics.revenue_by_course[course.name] || 0).toLocaleString()} collected</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {canManageCourses && (
                                        <button
                                            onClick={() => handleToggleCourseActive(course)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
                                            title="Toggle Active/Inactive"
                                        >
                                            {course.is_active === false ? 'Activate' : 'Deactivate'}
                                        </button>
                                    )}
                                    {canManageCourses && (
                                        <button
                                            onClick={() => setEditingCourse(course)}
                                            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                                            title="Edit Course"
                                        >
                                            Edit
                                        </button>
                                    )}
                                    {canManageCourses && (
                                        <button
                                            onClick={() => handleDeleteCourse(course.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                            title="Delete Course"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Edit Course Modal */}
            {editingCourse && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Edit Course</h3>
                        <form onSubmit={handleUpdateCourse} style={{ display: 'grid', gap: '1rem' }}>
                            <div>
                                <label className="label">School</label>
                                <select
                                    className="input"
                                    value={editingCourse.school_name}
                                    onChange={e => setEditingCourse({ ...editingCourse, school_name: e.target.value })}
                                    required
                                >
                                    {schools.map(school => (
                                        <option key={school.id} value={school.name}>
                                            {school.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Course Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editingCourse.name}
                                    onChange={e => setEditingCourse({ ...editingCourse, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Course Code</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={editingCourse.code}
                                    onChange={e => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                                    required
                                    maxLength={5}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    Save Changes
                                </button>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingCourse(null)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
