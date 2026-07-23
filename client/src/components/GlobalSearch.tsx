import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Search, X } from 'lucide-react'

// SRS Doc 6 §11 "Global Search" — student name/ID/mobile/email, batch, course.
export default function GlobalSearch() {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const [results, setResults] = useState<{ students: any[]; batches: any[] }>({ students: [], batches: [] })
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults({ students: [], batches: [] })
            return
        }
        const timeout = setTimeout(async () => {
            try {
                const res = await authedFetch(`/api/search?q=${encodeURIComponent(query.trim())}`)
                const data = await res.json()
                if (res.ok) setResults(data)
            } catch (err) {
                console.error('Global search error:', err)
            }
        }, 300)
        return () => clearTimeout(timeout)
    }, [query])

    const hasResults = results.students.length > 0 || results.batches.length > 0

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '340px' }}>
            <div style={{ position: 'relative' }}>
                <input
                    className="input"
                    placeholder="Search students, batches..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
                    onFocus={() => setOpen(true)}
                    style={{ paddingLeft: '1rem', paddingRight: '2.2rem', fontSize: '0.85rem', background: 'var(--surface-hover)', border: '1px solid transparent' }}
                />
                {query ? (
                    <button
                        onClick={() => { setQuery(''); setResults({ students: [], batches: [] }) }}
                        style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                        <X size={15} />
                    </button>
                ) : (
                    <Search size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
                )}
            </div>

            {open && query.trim().length >= 2 && (
                <div className="card" style={{ position: 'absolute', top: 'calc(100% + 0.4rem)', left: 0, right: 0, zIndex: 50, padding: 0, maxHeight: '360px', overflowY: 'auto' }}>
                    {!hasResults ? (
                        <div style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No matches.</div>
                    ) : (
                        <>
                            {results.students.length > 0 && (
                                <div>
                                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Students</div>
                                    {results.students.map(s => (
                                        <div
                                            key={s.id}
                                            onClick={() => { setOpen(false); setQuery(''); navigate(`/dashboard/student/${s.id}`) }}
                                            style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.student_name} {s.official_student_id ? `(${s.official_student_id})` : ''}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.student_email} · {s.batch_name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {results.batches.length > 0 && (
                                <div>
                                    <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Batches</div>
                                    {results.batches.map(b => (
                                        <div
                                            key={b.id}
                                            onClick={() => { setOpen(false); setQuery(''); navigate(`/dashboard/batch/${b.id}`) }}
                                            style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{b.name} ({b.id})</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{b.course} · {b.school}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
