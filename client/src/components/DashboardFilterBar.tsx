import { useEffect, useState } from 'react'

export interface DashboardFilters {
    range: string
    region: string
    school: string
    course: string
}

const RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'last_3_months', label: 'Last 3 Months' },
    { value: 'last_6_months', label: 'Last 6 Months' },
    { value: 'this_year', label: 'This Year' },
]

// SRS common requirement (Doc 1 §9, Doc 6 §2): every dashboard gets the same filter set —
// a date-range preset defaulting to "This Month", plus Region/School/Course. Computing the
// actual from/to bounds lives here so every dashboard gets identical semantics.
export function rangeToDates(range: string): { from: string; to: string } {
    const now = new Date()
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }

    switch (range) {
        case 'today':
            return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
        case 'yesterday': {
            const y = new Date(now); y.setDate(y.getDate() - 1)
            return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
        }
        case 'this_week': {
            const start = new Date(now); start.setDate(now.getDate() - now.getDay())
            return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() }
        }
        case 'last_month': {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const end = new Date(now.getFullYear(), now.getMonth(), 0)
            return { from: startOfDay(start).toISOString(), to: endOfDay(end).toISOString() }
        }
        case 'last_3_months': {
            const start = new Date(now.getFullYear(), now.getMonth() - 3, 1)
            return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() }
        }
        case 'last_6_months': {
            const start = new Date(now.getFullYear(), now.getMonth() - 6, 1)
            return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() }
        }
        case 'this_year': {
            const start = new Date(now.getFullYear(), 0, 1)
            return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() }
        }
        case 'this_month':
        default: {
            const start = new Date(now.getFullYear(), now.getMonth(), 1)
            return { from: startOfDay(start).toISOString(), to: endOfDay(now).toISOString() }
        }
    }
}

export default function DashboardFilterBar({ filters, onChange, showRegion = true, showSchool = true, showCourse = true }: {
    filters: DashboardFilters
    onChange: (f: DashboardFilters) => void
    showRegion?: boolean
    showSchool?: boolean
    showCourse?: boolean
}) {
    const [regions, setRegions] = useState<any[]>([])
    const [schools, setSchools] = useState<any[]>([])

    useEffect(() => {
        fetch('/api/regions').then(r => r.json()).then(d => setRegions(d.regions || [])).catch(() => {})
        fetch('/api/schools').then(r => r.json()).then(d => setSchools(d.schools || [])).catch(() => {})
    }, [])

    return (
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Date Range</label>
                <select className="input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem' }} value={filters.range} onChange={e => onChange({ ...filters, range: e.target.value })}>
                    {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
            {showRegion && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Region</label>
                    <select className="input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem' }} value={filters.region} onChange={e => onChange({ ...filters, region: e.target.value })}>
                        <option value="">All Regions</option>
                        {regions.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                    </select>
                </div>
            )}
            {showSchool && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>School</label>
                    <select className="input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem' }} value={filters.school} onChange={e => onChange({ ...filters, school: e.target.value })}>
                        <option value="">All Schools</option>
                        {schools.map((s: any) => <option key={s._id} value={s.name}>{s.name}</option>)}
                    </select>
                </div>
            )}
            {showCourse && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Course</label>
                    <input
                        className="input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem', width: '160px' }}
                        placeholder="All Courses"
                        value={filters.course}
                        onChange={e => onChange({ ...filters, course: e.target.value })}
                    />
                </div>
            )}
            <button
                onClick={() => onChange({ range: 'this_month', region: '', school: '', course: '' })}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 1rem', fontSize: '0.875rem' }}
            >
                Reset
            </button>
        </div>
    )
}
