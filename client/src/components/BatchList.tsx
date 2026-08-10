import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Users, Calendar, BookOpen, Clock, Edit, Trash2 } from 'lucide-react'

interface Batch {
    id: string
    name: string
    course: string
    strength: number
    start_date: string
    orientation_date?: string
    academic_lead: string
    school?: string
    region?: string
    course_fee?: number
    mode?: 'Online' | 'Offline'
    enrolled_count?: number
}

interface BatchListProps {
    view?: 'current' | 'past'
}

export default function BatchList({ view = 'current' }: BatchListProps) {
    const navigate = useNavigate()
    const [batches, setBatches] = useState<Batch[]>([])
    const [loading, setLoading] = useState(true)
    const [now, setNow] = useState(new Date())
    const [filterCourse, setFilterCourse] = useState('All')
    const [filterMode, setFilterMode] = useState('All')
    const [filterSchool, setFilterSchool] = useState('All')
    const [sortBy, setSortBy] = useState<'Date' | 'Filling'>('Date')
    const [userRole, setUserRole] = useState<string | null>(null)

    useEffect(() => {
        setUserRole(localStorage.getItem('userRole'))
    }, [])

    // 1. Get unique schools from ALL batches (always visible options)
    const uniqueSchools = Array.from(new Set(batches.map(b => b.school || ''))).filter(Boolean).sort()

    // 2. Get unique courses based on the SELECTED School
    const uniqueCourses = Array.from(new Set(
        batches
            .filter(b => filterSchool === 'All' || b.school === filterSchool)
            .map(b => b.course)
    )).sort()

    // 3. Reset Course filter when School changes to prevent invalid states
    useEffect(() => {
        setFilterCourse('All')
    }, [filterSchool])

    const filteredBatches = batches
        .filter(batch => {
            if (filterCourse !== 'All' && batch.course !== filterCourse) return false
            if (filterMode !== 'All' && (batch.mode || 'Offline') !== filterMode) return false
            if (filterSchool !== 'All' && batch.school !== filterSchool) return false
            return true
        })
        .sort((a, b) => {
            if (sortBy === 'Date') {
                return new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
            } else {
                const fillA = (a.enrolled_count || 0) / (a.strength || 1)
                const fillB = (b.enrolled_count || 0) / (b.strength || 1)
                return fillB - fillA // High to Low
            }
        })

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        fetchBatches()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]) // Refetch if view changes

    const fetchBatches = async () => {
        try {
            const res = await authedFetch(`/api/batches?view=${view}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setBatches(data.batches || [])
        } catch (error: any) {
            console.error('Error fetching batches:', error.message || error)
        } finally {
            setLoading(false)
        }
    }

    const getCountdown = (startDate: string) => {
        const start = new Date(startDate).getTime()
        const current = now.getTime()
        const diff = start - current

        if (diff <= 0) return { expired: true, text: 'Started' }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        return { expired: false, text: `${days}d ${hours}h ${minutes}m ${seconds}s` }
    }

    if (loading) return <div className="animate-pulse">Loading batches...</div>

    return (
        <div className="animate-fade-in">
            {/* Filter and Sort Controls */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>

                {/* 1. Filter by School (First, but conditional) */}
                {(userRole === 'ADMIN' || userRole === 'CEO') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Filter by School</label>
                        <select
                            className="input"
                            value={filterSchool}
                            onChange={(e) => setFilterSchool(e.target.value)}
                            style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                        >
                            <option value="All">All Schools</option>
                            {uniqueSchools.map(school => (
                                <option key={school} value={school}>{school}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* 2. Filter by Mode */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Filter by Mode</label>
                    <select
                        className="input"
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value)}
                        style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                    >
                        <option value="All">All Modes</option>
                        <option value="Online">Online</option>
                        <option value="Offline">Offline</option>
                    </select>
                </div>

                {/* 3. Filter by Course */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Filter by Course</label>
                    <select
                        className="input"
                        value={filterCourse}
                        onChange={(e) => setFilterCourse(e.target.value)}
                        style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                    >
                        <option value="All">All Courses</option>
                        {uniqueCourses.map(course => (
                            <option key={course} value={course}>{course}</option>
                        ))}
                    </select>
                </div>

                {/* 4. Sort By */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Sort By</label>
                    <select
                        className="input"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'Date' | 'Filling')}
                        style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                    >
                        <option value="Date">Start Date</option>
                        <option value="Filling">Batch Filling (High to Low)</option>
                    </select>
                </div>

                {/* 5. Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Actions</label>
                    <button
                        onClick={() => { setFilterCourse('All'); setFilterMode('All'); setFilterSchool('All'); setSortBy('Date'); }}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {filteredBatches.map((batch) => {
                    const isFull = (batch.enrolled_count || 0) >= (batch.strength || 0)
                    return (
                        <div
                            key={batch.id}
                            className="card"
                            onClick={() => navigate(`/dashboard/batch/${batch.id}`)}
                            style={{ transition: 'all 0.2s', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)'
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = ''
                            }}
                        >
                            {isFull && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(-25deg)',
                                    fontSize: '4rem',
                                    fontWeight: '900',
                                    color: 'rgba(153, 27, 27, 0.4)',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                    zIndex: 0,
                                    userSelect: 'none'
                                }}>
                                    HOUSE FULL
                                </div>
                            )}
                            <div style={{ position: 'relative', zIndex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>{batch.name}</h3>
                                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                                            <span className="badge badge-neutral">{batch.id}</span>
                                            {batch.mode && (
                                                <span className={`badge ${batch.mode === 'Online' ? 'badge-good' : 'badge-info'}`}>
                                                    {batch.mode}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Action Buttons: Edit & Delete */}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        {['ADMIN', 'CEO', 'ACADEMIC_LEAD'].includes(localStorage.getItem('userRole') || '') && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(`/dashboard/batch/${batch.id}/edit`)
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-secondary)',
                                                    padding: '0.25rem',
                                                    borderRadius: '0.25rem',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                title="Edit Batch"
                                            >
                                                <Edit size={18} />
                                            </button>
                                        )}

                                        {['ADMIN', 'CEO', 'ACADEMIC_LEAD'].includes(localStorage.getItem('userRole') || '') && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    if (!confirm(`Are you sure you want to delete batch "${batch.name}"?\nThis will remove all student enrollments!`)) return

                                                    try {
                                                        const res = await authedFetch(`/api/batches/${encodeURIComponent(batch.id)}`, { method: 'DELETE' })
                                                        const data = await res.json()
                                                        if (!res.ok) throw new Error(data.error || 'Failed to delete batch')

                                                        fetchBatches()
                                                    } catch (err: any) {
                                                        alert('Error deleting batch: ' + err.message)
                                                    }
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#ef4444',
                                                    padding: '0.25rem',
                                                    borderRadius: '0.25rem',
                                                    transition: 'background 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                                title="Delete Batch"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <BookOpen size={16} />
                                        <span>{batch.course}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                                            <svg width="24" height="24" viewBox="0 0 36 36">
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="#e2e8f0"
                                                    strokeWidth="4"
                                                />
                                                <path
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    fill="none"
                                                    stroke="var(--primary)"
                                                    strokeWidth="4"
                                                    strokeDasharray={`${((batch.enrolled_count || 0) / (batch.strength || 1)) * 100}, 100`}
                                                />
                                            </svg>
                                        </div>
                                        <span>{batch.enrolled_count || 0} / {batch.strength} Students</span>
                                    </div>
                                    {batch.school && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                            <BookOpen size={16} />
                                            <span>{batch.school}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                        <Calendar size={16} />
                                        <span>{new Date(batch.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    </div>
                                    {batch.region && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            <span>Region: {batch.region}</span>
                                            {batch.course_fee ? <span>· ₹{batch.course_fee.toLocaleString()}</span> : null}
                                        </div>
                                    )}
                                    {batch.orientation_date && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                            <span>Orientation: {new Date(batch.orientation_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Countdown Timer */}
                            {(() => {
                                const timeDiff = new Date(batch.start_date).getTime() - now.getTime()
                                const daysLeft = timeDiff / (1000 * 60 * 60 * 24)

                                let background = 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)'
                                let boxShadow = '0 4px 6px -1px rgba(76, 86, 214, 0.25)'
                                let animation = 'none'
                                let label = 'Orientation In'
                                let mainText = getCountdown(batch.start_date).text

                                if (isFull) {
                                    background = 'linear-gradient(135deg, #7f1d1d 0%, var(--error) 100%)'
                                    boxShadow = '0 4px 6px -1px rgba(220, 38, 38, 0.3)'
                                    label = 'Orientation In'
                                } else if (daysLeft <= 0) {
                                    background = 'linear-gradient(135deg, #14532d 0%, var(--success) 100%)'
                                    boxShadow = '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
                                    label = 'Batch Status'
                                    mainText = 'Done'
                                } else if (daysLeft <= 7) {
                                    background = 'linear-gradient(135deg, #991b1b 0%, var(--error) 100%)'
                                    boxShadow = '0 4px 6px -1px rgba(220, 38, 38, 0.3)'
                                    animation = 'pulse-slow 2s infinite'
                                    label = 'Orientation Soon!'
                                } else if (daysLeft <= 14) {
                                    background = 'linear-gradient(135deg, #92400e 0%, var(--warning) 100%)'
                                    boxShadow = '0 4px 6px -1px rgba(217, 119, 6, 0.3)'
                                    label = 'Orientation Upcoming'
                                }

                                return (
                                    <div style={{
                                        marginTop: '1.5rem',
                                        padding: '1rem',
                                        background,
                                        borderRadius: '0.75rem',
                                        color: 'white',
                                        textAlign: 'center',
                                        boxShadow,
                                        animation,
                                        position: 'relative',
                                        zIndex: 1
                                    }}>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.9, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <Clock size={14} />
                                            {label}
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: '700', fontFamily: 'monospace' }}>
                                            {mainText}
                                        </div>
                                    </div>
                                )
                            })()}


                        </div>
                    )
                })}
            </div>
        </div>
    )
}
