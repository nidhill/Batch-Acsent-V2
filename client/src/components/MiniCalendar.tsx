const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Lightweight read-only month view — no date-picking behavior, just a quick "what's today"
// glance triggered from the header pill's date/time, so no calendar library dependency needed.
export default function MiniCalendar() {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const firstDayOfWeek = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: (number | null)[] = [
        ...Array(firstDayOfWeek).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]

    return (
        <div style={{ width: '260px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center' }}>
                {WEEKDAYS.map((d, i) => (
                    <div key={i} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.25rem 0' }}>{d}</div>
                ))}
                {cells.map((day, i) => (
                    <div
                        key={i}
                        style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0',
                            borderRadius: '50%',
                            color: day === today.getDate() ? 'white' : day ? 'var(--text-primary)' : 'transparent',
                            background: day === today.getDate() ? 'var(--primary-dark)' : 'transparent',
                            fontWeight: day === today.getDate() ? 700 : 400,
                        }}
                    >
                        {day || '·'}
                    </div>
                ))}
            </div>
        </div>
    )
}
