import BatchList from '@/components/BatchList'

export default function BatchesPage() {
    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>All Batches</h2>
            <BatchList view="current" />
        </div>
    )
}
