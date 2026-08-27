import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Users, LogOut, ChevronLeft, ChevronRight, ChevronDown, BookOpen, Menu, TrendingUp, History, Activity, ClipboardCheck, FileText, UserSearch, ShieldCheck, Target } from 'lucide-react'
import styles from './dashboard.module.css'
import GlobalSearch from '@/components/GlobalSearch'
import MiniCalendar from '@/components/MiniCalendar'
import { authedFetch } from '@/lib/api'

const formatRole = (role: string) => role.split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')

// Ported from src/app/dashboard/layout.tsx. Dashboard auth-gating is client-side only (checks
// localStorage), matching the original — real authorization is enforced server-side per-route
// via requireUser/requireRole/can() regardless of what this gate allows through.
export default function DashboardLayout() {
    const location = useLocation()
    const pathname = location.pathname
    const navigate = useNavigate()
    const [role, setRole] = useState<string | null>(null)
    const [userName, setUserName] = useState<string>('User')
    // Defaults expanded and remembers the choice — previously reset to collapsed on
    // every page load/reload with no memory at all, forcing a manual re-expand each time.
    const [isCollapsed, setIsCollapsedState] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true')
    const setIsCollapsed = (value: boolean) => {
        setIsCollapsedState(value)
        localStorage.setItem('sidebarCollapsed', String(value))
    }
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [isNavScrolling, setIsNavScrolling] = useState(false)
    const navScrollTimeout = useRef<number | null>(null)
    const [now, setNow] = useState(new Date())
    const [showCalendar, setShowCalendar] = useState(false)
    const calendarRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 30000)
        return () => clearInterval(interval)
    }, [])

    // Auto-hides the nav's scrollbar 2s after the last scroll, matching the "only show it while
    // actually scrolling" behavior requested for the sidebar's nav list.
    const handleNavScroll = () => {
        setIsNavScrolling(true)
        if (navScrollTimeout.current) window.clearTimeout(navScrollTimeout.current)
        navScrollTimeout.current = window.setTimeout(() => setIsNavScrolling(false), 2000)
    }

    useEffect(() => {
        return () => {
            if (navScrollTimeout.current) window.clearTimeout(navScrollTimeout.current)
        }
    }, [])

    useEffect(() => {
        if (!showCalendar) return
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setShowCalendar(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showCalendar])

    useEffect(() => {
        const storedRole = localStorage.getItem('userRole')
        if (!storedRole || storedRole === 'PENDING') {
            if (storedRole === 'PENDING') {
                localStorage.removeItem('userRole')
            }
            navigate('/')
        } else if (storedRole === 'SHO' || storedRole === 'SSHO') {
            // SHO/SSHO workflows (calling students, learner agreements, adding students to a
            // batch) have moved to the SHO app now that it syncs from Batch Ascent V2 in
            // real time — there's nothing left for these roles to do here.
            localStorage.removeItem('userRole')
            localStorage.removeItem('userName')
            alert('This has moved to the SHO app. Please use the SHO app to continue — Batch Ascent no longer has SHO/SSHO features.')
            navigate('/')
        } else {
            setRole(storedRole)
            setUserName(localStorage.getItem('userName') || 'User')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileOpen(false)
    }, [pathname])

    // Badge on the Verification Queue nav item — replaces the old "Pending
    // Verifications" list on Overview, so the count is visible from every
    // page instead of only when looking at Overview. Same endpoint the
    // Verification Queue page itself uses, so the number always agrees.
    const canSeeVerificationQueue = ['ACADEMIC_LEAD', 'ADMIN', 'CEO', 'SALES_HEAD'].includes(role || '')
    const [pendingVerifications, setPendingVerifications] = useState(0)
    useEffect(() => {
        if (!canSeeVerificationQueue) return
        let cancelled = false
        const load = () => {
            authedFetch('/api/verification-queue')
                .then(res => res.json())
                .then(data => { if (!cancelled) setPendingVerifications((data.items || []).length) })
                .catch(() => {})
        }
        load()
        const interval = setInterval(load, 60000)
        return () => { cancelled = true; clearInterval(interval) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSeeVerificationQueue])

    if (!role) return null

    const expanded = !isCollapsed || isMobileOpen

    const navItems = [
        { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, roles: ['ACADEMIC_LEAD', 'ADMIN', 'BUSINESS_HEAD', 'CEO'] },
        { label: 'Executive Dashboard', href: '/dashboard/ceo', icon: Target, roles: ['CEO'] },
        { label: 'AL Dashboard', href: '/dashboard/academic-lead', icon: ClipboardCheck, roles: ['ACADEMIC_LEAD'] },
        { label: 'Status', href: '/dashboard/status', icon: TrendingUp, roles: ['ADMIN', 'CEO', 'BUSINESS_HEAD'] },
        { label: 'Sales Dashboard', href: '/dashboard/sales', icon: Users, roles: ['SALES', 'SALES_HEAD', 'ADMIN', 'CEO', 'BUSINESS_HEAD'] },
        { label: 'Student Admission', href: '/dashboard/sales/intimation', icon: PlusCircle, roles: ['SALES', 'ADMIN', 'CEO'] },
        { label: 'Upcoming Batches', href: '/dashboard/batches', icon: BookOpen, roles: ['BUSINESS_HEAD', 'CEO', 'SALES_HEAD', 'ADMIN'] },
        { label: 'Past Batches', href: '/dashboard/past-batches', icon: History, roles: ['ACADEMIC_LEAD', 'SALES_HEAD', 'ADMIN', 'CEO'] },
        { label: 'Create Batch', href: '/dashboard/create-batch', icon: PlusCircle, roles: ['ADMIN', 'SALES'] },
        { label: 'Verification Queue', href: '/dashboard/verification-queue', icon: ClipboardCheck, roles: ['ACADEMIC_LEAD', 'ADMIN', 'CEO', 'SALES_HEAD'] },
        { label: 'Student 360°', href: '/dashboard/student-360', icon: UserSearch, roles: ['ADMIN', 'CEO', 'BUSINESS_HEAD'] },
        { label: 'LMS Access Policy', href: '/dashboard/lms-access-policy', icon: ShieldCheck, roles: ['ADMIN', 'CEO', 'BUSINESS_HEAD'] },
        { label: 'Reports', href: '/dashboard/reports', icon: FileText, roles: ['ADMIN', 'CEO', 'BUSINESS_HEAD', 'ACADEMIC_LEAD'] },
        { label: 'Manage Schools & Courses', href: '/dashboard/admin/schools', icon: BookOpen, roles: ['ADMIN', 'CEO'] },
        { label: 'Manage Users', href: '/dashboard/admin/users', icon: Users, roles: ['ADMIN', 'CEO'] },
        { label: 'Approve Users', href: '/dashboard/admin/approve-users', icon: Users, roles: ['ADMIN', 'CEO'] },
        { label: 'Activity Logs', href: '/dashboard/admin/logs', icon: Activity, roles: ['ADMIN', 'CEO', 'BUSINESS_HEAD'] },
    ]

    const handleSignOut = () => {
        localStorage.removeItem('userRole')
        localStorage.removeItem('userName')
        navigate('/')
    }

    return (
        <div className={styles.layout}>
            {isMobileOpen && (
                <div
                    className={styles.mobileOverlay}
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''} ${isMobileOpen ? styles.mobileOpen : ''}`}>
                <div className={styles.brandRow}>
                    <div className={styles.logoBadge}>
                        <img src="/logo.jpg" alt="Logo" />
                    </div>
                    {expanded && <span className={styles.wordmark}>Batch Ascent</span>}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={styles.headerIconBtn}
                        style={{ display: isMobileOpen ? 'none' : 'flex' }}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </div>

                <nav className={`${styles.nav} ${isNavScrolling ? styles.navScrolling : ''}`} onScroll={handleNavScroll}>
                    {navItems.map((item) => (
                        item.roles.includes(role) && (
                            <Link
                                key={item.href}
                                to={item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                                title={item.label}
                                onClick={() => setIsMobileOpen(false)}
                            >
                                <span className={styles.navItemLeft}>
                                    <span className={styles.iconBox}>
                                        <item.icon size={18} />
                                    </span>
                                    <span className={styles.navLabel}>{item.label}</span>
                                </span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                                    {item.label === 'Verification Queue' && pendingVerifications > 0 && (
                                        <span style={{
                                            flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px',
                                            borderRadius: 999, background: 'var(--error)', color: 'white',
                                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            lineHeight: 1,
                                        }}>
                                            {pendingVerifications > 99 ? '99+' : pendingVerifications}
                                        </span>
                                    )}
                                    <ChevronRight size={15} className={styles.chevron} />
                                </span>
                            </Link>
                        )
                    ))}
                </nav>

                <div className={styles.sidebarFooter}>
                    <button onClick={handleSignOut} className={styles.signOutBtn} title="Sign out">
                        <span className={styles.signOutIconBox}>
                            <LogOut size={18} />
                        </span>
                        <span className={styles.navLabel}>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className={styles.main}>
                <header className={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            className={styles.mobileToggle}
                            onClick={() => setIsMobileOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className={styles.title}>
                            {navItems.find(i => i.href === pathname)?.label || 'Dashboard'}
                        </h2>
                    </div>
                    <div className={styles.desktopOnly}>
                        <GlobalSearch />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifySelf: 'end' }}>
                        <div className={`${styles.headerPill} ${styles.desktopOnly}`}>
                            <div className={styles.pillProfile} onClick={() => navigate('/dashboard/profile')} title="View profile">
                                <div className={styles.pillAvatar}>
                                    <Users size={16} />
                                </div>
                                <div>
                                    <div className={styles.pillName}>{userName}</div>
                                    <div className={styles.pillRole}>{formatRole(role)}</div>
                                </div>
                                <ChevronDown size={14} className={styles.pillChevron} />
                            </div>
                            <div className={styles.pillDivider} />
                            <div style={{ position: 'relative' }} ref={calendarRef}>
                                <div className={styles.pillDateTime} onClick={() => setShowCalendar(v => !v)} style={{ cursor: 'pointer' }} title="Open calendar">
                                    <div>{now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                    <div>{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                                </div>
                                {showCalendar && (
                                    <div className={styles.calendarPopover}>
                                        <MiniCalendar />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>
                <Outlet />
            </main>
        </div>
    )
}
