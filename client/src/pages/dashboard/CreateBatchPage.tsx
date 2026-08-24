import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch, API_BASE } from '@/lib/api'
import { Save } from 'lucide-react'
import { SCHOOLS } from '@/lib/constants'

export default function CreateBatchPage() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [userSchool, setUserSchool] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        course: '',
        start_date: '',
        end_date: '',
        orientation_date: '',
        sho_name: '',
        academic_lead: '',
        strength: '',
        school: '',
        mode: 'Offline',
        region: '',
        course_fee: '',
        course_type: ''
    })
    const [academicLeads, setAcademicLeads] = useState<any[]>([])
    const [availableSHOs, setAvailableSHOs] = useState<any[]>([])
    const [schoolsList, setSchoolsList] = useState<any[]>([])
    const [regionsList, setRegionsList] = useState<any[]>([])
    const [idError, setIdError] = useState<string | null>(null)
    const [idChecking, setIdChecking] = useState(false)

    // Fetch Schools on component mount
    useEffect(() => {
        const fetchSchools = async () => {
            try {
                const res = await authedFetch('/api/schools')
                const data = await res.json()
                const schools = (data.schools || []).map((s: any) => ({ ...s, id: s._id }))
                if (schools.length > 0) {
                    setSchoolsList(schools)
                } else {
                    setSchoolsList(SCHOOLS.map(s => ({ name: s })))
                }
            } catch (err) {
                console.error('Error fetching schools:', err)
                setSchoolsList(SCHOOLS.map(s => ({ name: s })))
            }
        }
        fetchSchools()
    }, [])

    // Fetch Regions on component mount
    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/regions`)
                const data = await res.json()
                setRegionsList(data.regions || [])
                if (data.regions?.length === 1) {
                    setFormData(prev => ({ ...prev, region: data.regions[0]._id }))
                }
            } catch (err) {
                console.error('Error fetching regions:', err)
            }
        }
        fetchRegions()
    }, [])

    const [availableCourses, setAvailableCourses] = useState<any[]>([])

    useEffect(() => {
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
        fetchCourses()
    }, [])

    useEffect(() => {
        fetchAcademicLeads()
    }, [])

    const fetchAcademicLeads = async () => {
        try {
            const res = await authedFetch('/api/users?directory=1&role=ACADEMIC_LEAD')
            const data = await res.json()
            if (data.users) setAcademicLeads(data.users)
        } catch (error) {
            console.error('Error fetching leads:', error)
        }
    }

    const fetchSHOs = async (school: string) => {
        try {
            const res = await authedFetch(`/api/users?directory=1&role=SHO,SSHO&school=${encodeURIComponent(school)}`)
            const data = await res.json()
            if (data.users) setAvailableSHOs(data.users)
        } catch (error) {
            console.error('Error fetching SHOs:', error)
        }
    }

    // Auto-select Academic Lead when School is set
    useEffect(() => {
        if (formData.school) {
            // Fetch SHOs when school changes (or is set initially)
            fetchSHOs(formData.school)

            // Auto-select lead
            if (academicLeads.length > 0) {
                const leadForSchool = academicLeads.find(lead => lead.school === formData.school)
                if (leadForSchool) {
                    setFormData(prev => ({ ...prev, academic_lead: leadForSchool.name }))
                } else {
                    // Clear lead if none found for this school (optional, but good for admin switching schools)
                    setFormData(prev => ({ ...prev, academic_lead: '' }))
                }
            }
        } else {
            setAvailableSHOs([])
            setFormData(prev => ({ ...prev, academic_lead: '' }))
        }
    }, [formData.school, academicLeads])

    useState(() => {
        // Load user school and name from local storage
        const school = localStorage.getItem('userSchool')
        const name = localStorage.getItem('userName')
        const role = localStorage.getItem('userRole')

        if (school && role !== 'ADMIN' && role !== 'CEO') {
            setUserSchool(school)
            setFormData(prev => ({ ...prev, school }))
            // fetchSHOs(school) // Handled by the new useEffect
        }

        if (name) {
            if (role === 'ACADEMIC_LEAD') {
                setFormData(prev => ({ ...prev, academic_lead: name }))
            }
        }
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (idError) {
                alert(idError)
                setLoading(false)
                return
            }

            const res = await authedFetch('/api/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, strength: parseInt(formData.strength) })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create batch')

            alert('Batch created successfully!')
            navigate('/dashboard')
        } catch (error: any) {
            console.error('Error creating batch:', error)
            alert('Error creating batch: ' + (error.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const checkIdExists = async (id: string) => {
        if (!id) { setIdError(null); return }
        setIdChecking(true)
        try {
            const res = await authedFetch(`/api/batches/${encodeURIComponent(id)}`)
            setIdChecking(false)
            if (res.ok) {
                setIdError(`Batch ID "${id}" already exists. Please use a different ID.`)
            } else {
                setIdError(null)
            }
        } catch {
            setIdChecking(false)
            setIdError(null)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = e.target.value

        if (e.target.name === 'id') {
            value = value.replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase()
            checkIdExists(value)
        }

        setFormData({ ...formData, [e.target.name]: value })
    }

    return (
        <div className="card animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Create New Batch</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Batch ID</label>
                        <input
                            name="id"
                            type="text"
                            className="input"
                            placeholder="e.g. BATCH-001"
                            required
                            onChange={handleChange}
                        />
                        {idChecking && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Checking ID...</p>}
                        {idError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem', fontWeight: 500 }}>⚠ {idError}</p>}
                        {!idError && !idChecking && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Only letters, numbers, hyphens (-), and underscores (_) allowed.</p>}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Batch Name</label>
                        <input
                            name="name"
                            type="text"
                            className="input"
                            placeholder="e.g. Alpha Cohort 2024"
                            required
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Course Name</label>
                        <select
                            name="course"
                            className="input"
                            required
                            value={formData.course}
                            onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                        >
                            <option value="">Select Course</option>
                            {availableCourses
                                .filter(course => {
                                    // If no school selected, show nothing or all (better show nothing until school selected, or all)
                                    // Let's show all if no school selected, but filter by school if one is selected.
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
                        {/* Was mislabeled "Orientation Date" while bound to start_date — SRS
                            treats Batch Start Date and Orientation Date as two distinct fields
                            (Doc 1 §"Batch Management" / Doc 4 §5 "Batch Schedule"). */}
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Batch Start Date *</label>
                        <input
                            name="start_date"
                            type="date"
                            className="input"
                            required
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        {/* Read by the SHO app (same MongoDB cluster) to decide which Learner
                            Agreement (main vs short course) a student gets — Batch Ascent V2 no
                            longer sends agreements itself, but this field is still the source
                            of truth SHO app looks up by batch code. Keep it required. */}
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Course Type *</label>
                        <select
                            name="course_type"
                            className="input"
                            required
                            value={formData.course_type}
                            onChange={handleChange}
                        >
                            <option value="">Select Course Type</option>
                            <option value="main">Main Course</option>
                            <option value="short">Short Course</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Orientation Date</label>
                        <input
                            name="orientation_date"
                            type="date"
                            className="input"
                            value={formData.orientation_date}
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Expected End Date</label>
                        <input
                            name="end_date"
                            type="date"
                            className="input"
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Batch Strength</label>
                        <input
                            name="strength"
                            type="number"
                            className="input"
                            placeholder="e.g. 50"
                            required
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Course Fee (₹)</label>
                        <input
                            name="course_fee"
                            type="number"
                            min="0"
                            className="input"
                            placeholder="e.g. 50000"
                            required
                            value={formData.course_fee}
                            onChange={handleChange}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            This becomes the default course fee for all students in this batch. Sales cannot change it — only apply a discount/scholarship.
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>SHO Name</label>
                        <select
                            name="sho_name"
                            className="input"
                            required
                            disabled={!formData.school}
                            value={formData.sho_name}
                            onChange={(e) => setFormData({ ...formData, sho_name: e.target.value })}
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
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Academic Lead</label>
                        <input
                            name="academic_lead"
                            className="input"
                            required
                            value={formData.academic_lead}
                            readOnly
                            style={{ background: 'var(--surface-hover)', cursor: 'not-allowed' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            {localStorage.getItem('userRole') === 'ACADEMIC_LEAD'
                                ? '* You are the Academic Lead'
                                : `* Auto-assigned for ${formData.school || 'selected school'}`
                            }
                        </div>
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>School / Department</label>
                    <select
                        name="school"
                        className="input"
                        required
                        value={formData.school}
                        onChange={handleChange}
                        disabled={!!userSchool}
                        style={userSchool ? { background: 'var(--surface-hover)', cursor: 'not-allowed' } : {}}
                    >
                        <option value="">Select School</option>
                        {schoolsList.map(school => (
                            <option key={school.id || school.name} value={school.name}>{school.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Region</label>
                    <select
                        name="region"
                        className="input"
                        required
                        value={formData.region}
                        onChange={handleChange}
                    >
                        <option value="">Select Region</option>
                        {regionsList.map(region => (
                            <option key={region._id} value={region._id}>{region.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Mode</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, mode: 'Offline' })}
                            className={`btn ${formData.mode === 'Offline' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: 1 }}
                        >
                            Offline
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, mode: 'Online' })}
                            className={`btn ${formData.mode === 'Online' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ flex: 1 }}
                        >
                            Online
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={loading || !!idError || idChecking}>
                        <Save size={20} style={{ marginRight: '0.5rem' }} />
                        {loading ? 'Creating...' : 'Create Batch'}
                    </button>
                </div>
            </form>
        </div>
    )
}
