import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { authedFetch } from '@/lib/api'
import { CheckCircle, XCircle, ArrowRightLeft, Clock, MessageSquareWarning } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
    new_admission: 'New Admission',
    post_start_addition: 'Post-Start Addition',
    transfer_request: 'Transfer Request',
}

interface DialogConfig {
    title: string
    description: string
    showInput?: boolean
    inputPlaceholder?: string
    inputRequired?: boolean
    confirmLabel: string
    confirmColor: 'primary' | 'warning' | 'error'
    onConfirm: (value: string) => void
}

export default function VerificationQueuePage() {
    const [items, setItems] = useState<any[]>([])
    const [transferRequests, setTransferRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState<'admissions' | 'transfers'>('admissions')
    const [dialog, setDialog] = useState<DialogConfig | null>(null)
    const [dialogValue, setDialogValue] = useState('')

    const openDialog = (config: DialogConfig) => {
        setDialogValue('')
        setDialog(config)
    }
    const closeDialog = () => setDialog(null)
    const confirmDialog = () => {
        if (!dialog) return
        if (dialog.showInput && dialog.inputRequired && !dialogValue.trim()) return
        dialog.onConfirm(dialogValue.trim())
        closeDialog()
    }

    const fetchQueue = async () => {
        setLoading(true)
        try {
            const res = await authedFetch('/api/verification-queue')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setItems(data.items || [])
        } catch (err) {
            console.error('Error fetching verification queue:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchTransferRequests = async () => {
        try {
            const res = await authedFetch('/api/batch-transfer-requests?status=pending')
            const data = await res.json()
            if (res.ok) setTransferRequests(data.requests || [])
        } catch (err) {
            console.error('Error fetching transfer requests:', err)
        }
    }

    useEffect(() => {
        fetchQueue()
        fetchTransferRequests()
    }, [])

    const handleVerify = (id: string, name: string) => {
        openDialog({
            title: 'Verify Student',
            description: `Verify ${name}? This confirms the admission is accurate and moves them into the active pipeline.`,
            confirmLabel: 'Verify',
            confirmColor: 'primary',
            onConfirm: async () => {
                try {
                    const res = await authedFetch(`/api/admissions/${id}/verify`, { method: 'POST' })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    fetchQueue()
                } catch (err: any) {
                    alert('Error: ' + err.message)
                }
            }
        })
    }

    const handleReject = (id: string, name: string) => {
        openDialog({
            title: 'Reject Admission',
            description: `Rejecting ${name} removes this admission from the verification queue. You can add a reason below (optional).`,
            showInput: true,
            inputPlaceholder: 'Reason for rejection...',
            confirmLabel: 'Reject',
            confirmColor: 'error',
            onConfirm: async (reason) => {
                try {
                    const res = await authedFetch(`/api/admissions/${id}/reject`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    fetchQueue()
                } catch (err: any) {
                    alert('Error: ' + err.message)
                }
            }
        })
    }

    const handleRequestChanges = (id: string, name: string) => {
        openDialog({
            title: 'Request Changes',
            description: `What changes are needed for ${name}? This message goes back to the Sales Executive who submitted the admission.`,
            showInput: true,
            inputPlaceholder: 'e.g. Missing guardian contact number...',
            inputRequired: true,
            confirmLabel: 'Send Request',
            confirmColor: 'warning',
            onConfirm: async (message) => {
                try {
                    const res = await authedFetch(`/api/admissions/${id}/request-changes`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    fetchQueue()
                } catch (err: any) {
                    alert('Error: ' + err.message)
                }
            }
        })
    }

    const handleApproveTransfer = (id: string) => {
        openDialog({
            title: 'Approve Transfer',
            description: 'Approve this batch transfer? The student will be moved to the destination batch immediately.',
            confirmLabel: 'Approve',
            confirmColor: 'primary',
            onConfirm: async () => {
                try {
                    const res = await authedFetch(`/api/batch-transfer-requests/${id}/approve`, { method: 'POST' })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    fetchTransferRequests()
                } catch (err: any) {
                    alert('Error: ' + err.message)
                }
            }
        })
    }

    const handleRejectTransfer = (id: string) => {
        openDialog({
            title: 'Reject Transfer',
            description: 'Rejecting this transfer keeps the student in their original batch. You can add a reason below (optional).',
            showInput: true,
            inputPlaceholder: 'Reason for rejection...',
            confirmLabel: 'Reject',
            confirmColor: 'error',
            onConfirm: async (reason) => {
                try {
                    const res = await authedFetch(`/api/batch-transfer-requests/${id}/reject`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reason })
                    })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error)
                    fetchTransferRequests()
                } catch (err: any) {
                    alert('Error: ' + err.message)
                }
            }
        })
    }

    if (loading) return <div>Loading...</div>

    const colorVar = { primary: 'var(--primary)', warning: 'var(--warning)', error: 'var(--error)' }[dialog?.confirmColor || 'primary']

    return (
        <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Verification Queue</h2>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button
                    onClick={() => setTab('admissions')}
                    className={`btn ${tab === 'admissions' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    Pending Admissions ({items.length})
                </button>
                <button
                    onClick={() => setTab('transfers')}
                    className={`btn ${tab === 'transfers' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    Transfer Requests ({transferRequests.length})
                </button>
            </div>

            {tab === 'admissions' && (
                items.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>All caught up — no students pending verification.</div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {items.map(item => (
                            <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{item.student_name}</span>
                                        <span style={{
                                            fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
                                            background: item.action_type === 'new_admission' ? 'var(--info-light)' : 'var(--warning-light)',
                                            color: item.action_type === 'new_admission' ? 'var(--info)' : 'var(--warning)',
                                        }}>
                                            {ACTION_LABELS[item.action_type] || item.action_type}
                                        </span>
                                        {item.added_by_role && ['SHO', 'SSHO'].includes(item.added_by_role) && (
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>added by {item.added_by_role}</span>
                                        )}
                                        {item.verification_status === 'changes_requested' && (
                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'var(--warning-light)', color: 'var(--warning)' }}>
                                                Changes Requested
                                            </span>
                                        )}
                                    </div>
                                    {item.verification_status === 'changes_requested' && item.changes_requested_message && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                                            "{item.changes_requested_message}"
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {item.student_email} · {item.student_phone}
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        Batch: <strong>{item.batch_name || item.batch_id}</strong> ({item.course}) · Sales: {item.sales_executive || '—'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Clock size={12} /> {item.linked_at ? new Date(item.linked_at).toLocaleString() : '—'} · Payment: {item.payment_status}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleVerify(item.id, item.student_name)}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                                    >
                                        <CheckCircle size={16} /> Verify
                                    </button>
                                    <button
                                        onClick={() => handleRequestChanges(item.id, item.student_name)}
                                        className="btn"
                                        style={{ background: 'none', border: '1px solid var(--warning)', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                                    >
                                        <MessageSquareWarning size={16} /> Request Changes
                                    </button>
                                    <button
                                        onClick={() => handleReject(item.id, item.student_name)}
                                        className="btn"
                                        style={{ background: 'none', border: '1px solid var(--error)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {tab === 'transfers' && (
                transferRequests.length === 0 ? (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No pending transfer requests.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        {transferRequests.map(r => (
                            <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>{r.student?.student_name}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        {r.from_batch_name || r.from_batch_id} <ArrowRightLeft size={12} /> {r.to_batch_name || r.to_batch_id}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        Requested {r.requested_at ? new Date(r.requested_at).toLocaleString() : '—'} by {r.requested_by_role}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleApproveTransfer(r.id)}
                                        className="btn btn-primary"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                                    >
                                        <CheckCircle size={16} /> Approve
                                    </button>
                                    <button
                                        onClick={() => handleRejectTransfer(r.id)}
                                        className="btn"
                                        style={{ background: 'none', border: '1px solid var(--error)', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                                    >
                                        <XCircle size={16} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* Custom confirm/prompt modal — replaces the browser's native confirm()/prompt() dialogs
                everywhere on this page with something that matches the app's own design language.
                Portaled to document.body: page.tsx's own root div carries the `animate-fade-in`
                class, whose animation ends on a (0,0) `transform` that's still non-`none` — any
                non-`none` transform on an ancestor creates a new containing block for `position:
                fixed` descendants, silently turning "fixed" into "fixed relative to that
                scrolled ancestor" instead of the viewport. Portaling to body sidesteps the whole
                class of bug regardless of what any ancestor does. */}
            {dialog && createPortal(
                <div
                    onClick={closeDialog}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(15, 20, 45, 0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
                        animation: 'fadeIn 0.15s ease-out',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="card"
                        style={{ width: '100%', maxWidth: '420px', margin: '1rem', boxShadow: 'var(--shadow-lg)' }}
                    >
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.6rem' }}>{dialog.title}</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: dialog.showInput ? '1rem' : '1.5rem' }}>
                            {dialog.description}
                        </p>
                        {dialog.showInput && (
                            <textarea
                                autoFocus
                                className="input"
                                rows={3}
                                placeholder={dialog.inputPlaceholder}
                                value={dialogValue}
                                onChange={(e) => setDialogValue(e.target.value)}
                                style={{ marginBottom: '1.5rem', resize: 'vertical' }}
                            />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                            <button onClick={closeDialog} className="btn btn-secondary">Cancel</button>
                            <button
                                onClick={confirmDialog}
                                disabled={!!(dialog.showInput && dialog.inputRequired && !dialogValue.trim())}
                                className="btn"
                                style={{
                                    background: colorVar, color: 'white',
                                    opacity: (dialog.showInput && dialog.inputRequired && !dialogValue.trim()) ? 0.5 : 1,
                                    cursor: (dialog.showInput && dialog.inputRequired && !dialogValue.trim()) ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {dialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
