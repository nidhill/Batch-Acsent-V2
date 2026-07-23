import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authedFetch } from '@/lib/api'
import { Search, User } from 'lucide-react'

export default function Student360Page() {
    const navigate = useNavigate()
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searched, setSearched] = useState(false)

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!query.trim()) return
        setLoading(true)
        setSearched(true)
        try {
            const res = await authedFetch(`/api/admissions?q=${encodeURIComponent(query.trim())}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setResults(data.admissions || [])
        } catch (err) {
            console.error('Error searching students:', err)
            setResults([])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={22} /> Student 360° Profile
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Search by name, email or phone to see a student's full admission, payment and activity history.
            </p>

            <form onSubmit={handleSearch} className="card" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <input
                    type="text"
                    className="input"
                    placeholder="Search student name, email or phone..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={16} /> {loading ? 'Searching...' : 'Search'}
                </button>
            </form>

            {searched && !loading && results.length === 0 && (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No students matched "{query}".
                </div>
            )}

            {results.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {results.map((r, i) => (
                        <div
                            key={r.id}
                            onClick={() => navigate(`/dashboard/student/${r.id}`)}
                            style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '1rem 1.5rem', cursor: 'pointer',
                                borderBottom: i !== results.length - 1 ? '1px solid var(--border)' : 'none',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <div>
                                <div style={{ fontWeight: 'bold' }}>{r.student_name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{r.student_email} · {r.batch_name || r.batch_id}</div>
                            </div>
                            <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
