import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { authedFetch } from '@/lib/api'

export default function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<any[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const ref = useRef<HTMLDivElement>(null)

    const fetchNotifications = async () => {
        try {
            const res = await authedFetch('/api/notifications')
            const data = await res.json()
            if (res.ok) {
                setNotifications(data.notifications || [])
                setUnreadCount(data.unread_count || 0)
            }
        } catch (err) {
            console.error('Error fetching notifications:', err)
        }
    }

    useEffect(() => {
        fetchNotifications()
        // Light polling — no push infra exists yet (SRS marks Push as "Future" anyway)
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleOpen = () => {
        setOpen(prev => !prev)
        if (!open) fetchNotifications()
    }

    const markAllRead = async () => {
        await authedFetch('/api/notifications', {
            method: 'PATCH',
            body: JSON.stringify({ all: true }),
        })
        setUnreadCount(0)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }

    const handleClickNotification = async (n: any) => {
        if (!n.is_read) {
            await authedFetch('/api/notifications', {
                method: 'PATCH',
                body: JSON.stringify({ id: n.id }),
            })
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
            setUnreadCount(prev => Math.max(0, prev - 1))
        }
        setOpen(false)
        if (n.link) navigate(n.link)
    }

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={handleOpen}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: variant === 'dark' ? '#c2c6ee' : 'var(--text-secondary)', padding: '0.5rem' }}
                title="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: '2px', right: '2px', background: '#ef4444', color: 'white',
                        borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, minWidth: '16px', height: '16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: '0.5rem', width: '340px', maxHeight: '420px', overflowY: 'auto',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', zIndex: 100
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
                        <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem', cursor: 'pointer' }}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            No notifications yet.
                        </div>
                    ) : (
                        notifications.map(n => (
                            <div
                                key={n.id}
                                onClick={() => handleClickNotification(n)}
                                style={{
                                    padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                                    background: n.is_read ? 'transparent' : 'var(--surface-hover)',
                                }}
                            >
                                <div style={{ fontSize: '0.85rem', fontWeight: n.is_read ? 500 : 700 }}>{n.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{n.message}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
