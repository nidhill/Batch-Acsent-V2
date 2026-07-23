import BatchList from '@/components/BatchList'

export default function PastBatchesPage() {
    return (
        <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Past Batches</h2>
            <BatchList view="past" />
        </div>
    )
}
