import { useEffect, useState } from 'react'
import ProjectOverview from '@/components/ProjectOverview'

export default function OverviewPage() {
    const [role, setRole] = useState<string | null>(null)
    const [userName, setUserName] = useState('')

    useEffect(() => {
        setRole(localStorage.getItem('userRole'))
        setUserName(localStorage.getItem('userName') || '')
    }, [])

    if (!role) return null

    const greetingHour = new Date().getHours()
    const timeGreeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div>
            <h2 className="text-2xl font-bold" style={{ color: 'var(--primary)', margin: 0, marginBottom: '1.5rem' }}>
                {timeGreeting}{userName ? `, ${userName}` : ''}
            </h2>
            <ProjectOverview />
        </div>
    )
}
