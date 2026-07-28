import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'

// Ported from src/app/dashboard/admin/layout.tsx. Matches the roles the sidebar nav actually
// exposes for /dashboard/admin/* pages (this previously only allowed ADMIN, so CEO/Business Head
// could see the nav link but got redirected away — actual write actions stay gated per-route
// server-side via the permission matrix regardless of what's allowed to view here).
export default function AdminGate() {
    const navigate = useNavigate()
    const [authorized, setAuthorized] = useState(false)

    useEffect(() => {
        const role = localStorage.getItem('userRole')
        if (!['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(role || '')) {
            navigate('/dashboard')
        } else {
            setAuthorized(true)
        }
    }, [navigate])

    if (!authorized) return null

    return <Outlet />
}
