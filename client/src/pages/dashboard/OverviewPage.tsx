import { useEffect, useState } from 'react'
import BatchList from '@/components/BatchList'
import ProjectOverview from '@/components/ProjectOverview'

export default function OverviewPage() {
    const [role, setRole] = useState<string | null>(null)

    useEffect(() => {
        setRole(localStorage.getItem('userRole'))
    }, [])

    if (!role) return null

    return (
        <div>
            {/* No page-title heading here — DashboardLayout's header bar already shows
                "Overview", and ProjectOverview opens with a personalized greeting. */}
            <ProjectOverview />
            <BatchList />
        </div>
    )
}
