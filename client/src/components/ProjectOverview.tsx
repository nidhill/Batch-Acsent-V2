import { useEffect, useState } from 'react'
import { authedFetch } from '@/lib/api'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts'

interface Batch {
    id: string
    course: string
    enrolled_count: number
    strength: number
    school?: string
    name: string
}

import { SCHOOLS } from '@/lib/constants'

export default function ProjectOverview() {
    const [batches, setBatches] = useState<Batch[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedSchool, setSelectedSchool] = useState<string>('All Schools')
    const [userRole, setUserRole] = useState<string | null>(null)
    const [stats, setStats] = useState({
        totalBatches: 0,
        totalStudents: 0,
        batchesPerCourse: [] as { name: string, count: number }[],
        batchesPerSchool: [] as { name: string, count: number }[],
        mostPopularCourse: '',
        enrollmentRate: 0,
        topSalesPerson: '',
        salesPerformance: [] as { name: string, count: number }[],
        toVerifyCount: 0,
        toCallCount: 0,
        toVerifyList: [] as any[],
        toCallList: [] as any[]
    })
    const [revenue, setRevenue] = useState<any>(null)
    const [analytics, setAnalytics] = useState<any>(null)

    useEffect(() => {
        const role = localStorage.getItem('userRole')
        setUserRole(role)
        fetchData(role, selectedSchool)
        fetchRevenue()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSchool])

    const fetchRevenue = async () => {
        try {
            const res = await authedFetch('/api/analytics/overview')
            const data = await res.json()
            if (res.ok) {
                setRevenue(data.revenue)
                setAnalytics(data)
            }
        } catch (err) {
            console.error('Error fetching revenue:', err)
        }
    }

    const fetchData = async (role: string | null, schoolFilter: string) => {
        try {
            setLoading(true)

            // Batches and Users don't depend on each other, so fetch them together instead of
            // one after another — this was the main reason "Loading analytics..." lingered
            // (three chained round-trips in sequence instead of the two independent ones
            // running in parallel).
            const [batchRes, usersRes] = await Promise.all([
                authedFetch('/api/batches?view=all'),
                authedFetch('/api/users?directory=1&role=ADMIN,SUB_ADMIN,SHO,SSHO,ACADEMIC_LEAD,SALES,SALES_HEAD,CEO'),
            ])
            const [batchJson, usersJson] = await Promise.all([batchRes.json(), usersRes.json()])

            let batchesData: any[] = batchJson.batches || []
            if ((role === 'CEO' || role === 'ADMIN') && schoolFilter !== 'All Schools') {
                batchesData = batchesData.filter(b => b.school === schoolFilter)
            }
            const usersData = (usersJson.users || []).filter((u: any) => u.sales_id)

            // Enrollments depend on which batches came back above, so this one has to wait
            let allBatches: Batch[] = []
            let allSalesIds: string[] = []
            let allEnrollments: any[] = []

            if (batchesData.length > 0) {
                const batchIds = batchesData.map(b => b.id)
                const admissionsRes = await authedFetch(`/api/admissions?batch_ids=${batchIds.map(encodeURIComponent).join(',')}`)
                const admissionsJson = await admissionsRes.json()
                const enrollments = admissionsJson.admissions || []

                allEnrollments = enrollments
                allBatches = batchesData.map(batch => {
                    const count = enrollments.filter((e: any) => e.batch_id === batch.id).length
                    return { ...batch, enrolled_count: count }
                })
                allSalesIds = enrollments.map((e: any) => e.sales_id).filter(Boolean)
            }

            setBatches(allBatches)
            calculateStats(allBatches, allSalesIds, usersData, allEnrollments)

        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const calculateStats = (batchData: any[], salesIds: string[], usersMap: any[], enrollments: any[]) => {
        const totalBatches = batchData.length
        const totalStudents = batchData.reduce((acc, curr) => acc + (curr.enrolled_count || 0), 0)
        const totalCapacity = batchData.reduce((acc, curr) => acc + (curr.strength || 0), 0)

        // Calculate Actionable Stats
        const toVerifyList = enrollments.filter(e => !(e.verified_at || e.status === 'Verified')).map(e => ({
            ...e,
            batch_name: batchData.find(b => b.id === e.batch_id)?.name || 'Unknown Batch'
        }))
        const toVerifyCount = toVerifyList.length

        const toCallList = enrollments.filter(e => (e.verified_at || e.status === 'Verified') && !e.called_at).map(e => ({
            ...e,
            batch_name: batchData.find(b => b.id === e.batch_id)?.name || 'Unknown Batch'
        }))
        const toCallCount = toCallList.length

        // Batches per course
        const courses: Record<string, number> = {}
        const studentsPerCourse: Record<string, number> = {}
        const schools: Record<string, number> = {}

        batchData.forEach(b => {
            courses[b.course] = (courses[b.course] || 0) + 1
            studentsPerCourse[b.course] = (studentsPerCourse[b.course] || 0) + (b.enrolled_count || 0)
            if (b.school) schools[b.school] = (schools[b.school] || 0) + 1
        })

        const batchesPerCourseArg = Object.entries(courses).map(([name, count]) => ({
            name,
            count
        }))

        const batchesPerSchoolArg = Object.entries(schools).map(([name, count]) => ({
            name,
            count
        })).sort((a, b) => b.count - a.count)

        // Most popular course
        let mostPopular = ''
        let maxStudents = 0
        Object.entries(studentsPerCourse).forEach(([course, count]) => {
            if (count > maxStudents) {
                maxStudents = count
                mostPopular = course
            }
        })

        // Sales Performance
        const salesCounts: Record<string, number> = {}
        salesIds.forEach(id => {
            salesCounts[id] = (salesCounts[id] || 0) + 1
        })

        let topSalesPersonName = '-'
        let maxSales = 0

        const salesPerformanceArg = Object.entries(salesCounts).map(([id, count]) => {
            // Real sales_id data has stray whitespace/casing inconsistencies (e.g. "MS-03 " vs
            // "MS-03") from years of manual entry — normalize both sides so those still resolve
            // to a real name instead of silently falling back to the raw id.
            const user = usersMap.find(u => u.sales_id && u.sales_id.trim().toUpperCase() === id.trim().toUpperCase())
            const name = user ? user.name : id

            if (count > maxSales) {
                maxSales = count
                topSalesPersonName = name
            }

            return { name, count }
        }).sort((a, b) => b.count - a.count).slice(0, 5)

        setStats({
            totalBatches,
            totalStudents,
            batchesPerCourse: batchesPerCourseArg,
            batchesPerSchool: batchesPerSchoolArg,
            mostPopularCourse: mostPopular,
            enrollmentRate: totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0,
            topSalesPerson: topSalesPersonName,
            salesPerformance: salesPerformanceArg,
            toVerifyCount,
            toCallCount,
            toVerifyList,
            toCallList
        })
    }

    if (loading) return <div className="animate-pulse">Loading analytics...</div>

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
    // Admin/CEO/Business Head get the full BI dashboard (KPI cards, revenue, charts) per
    // SRS Docs 2-3; SHO/SSHO/Sales Head/Academic Lead get the operational to-do list instead.
    const showActionableStats = ['SHO', 'SSHO', 'SALES_HEAD', 'ACADEMIC_LEAD'].includes(userRole || '')

    const userName = localStorage.getItem('userName') || ''
    const greetingHour = new Date().getHours()
    const timeGreeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening'

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--primary)', margin: 0 }}>{timeGreeting}{userName ? `, ${userName}` : ''}</h2>

                {['CEO', 'ADMIN', 'BUSINESS_HEAD'].includes(userRole || '') && (
                    <select
                        value={selectedSchool}
                        onChange={(e) => setSelectedSchool(e.target.value)}
                        className="input"
                        style={{ width: 'auto', minWidth: '200px' }}
                    >
                        <option value="All Schools">All Schools</option>
                        {SCHOOLS.map(school => (
                            <option key={school} value={school}>{school}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* KPI Cards / Verification List */}
            {showActionableStats ? (
                /* SHO / SSHO / SALES_HEAD View - LIST ONLY */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>

                    {/* SALES HEAD / ADMIN / CEO: See Pending Verifications */}
                    {['SALES_HEAD', 'ADMIN', 'CEO'].includes(userRole || '') && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
                                    Pending Verifications
                                    <span className="badge badge-warn">{stats.toVerifyList.length}</span>
                                </h3>
                            </div>

                            {stats.toVerifyList.length > 0 ? (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    {stats.toVerifyList.map((student: any, index: number) => (
                                        <a
                                            key={student.id}
                                            href={`/dashboard/batch/${student.batch_id}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '1rem 1.5rem',
                                                borderBottom: index !== stats.toVerifyList.length - 1 ? '1px solid var(--border)' : 'none',
                                                transition: 'background 0.2s',
                                                background: 'var(--surface)'
                                            }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: '50%',
                                                        background: 'var(--warning-light)', color: 'var(--warning)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {student.student_name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{student.student_name}</div>
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                            Batch: {student.batch_name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <span className="badge badge-warn">Action Required</span>
                                                    <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>All Caught Up!</div>
                                    <div>No students currently pending verification.</div>
                                </div>
                            )}
                        </>
                    )}

                    {/* SHO / SSHO / ADMIN / CEO / Academic Lead: See Pending Calls. Sales Head is
                        deliberately excluded — SRS Doc 3 §"Remove Operational Features" says
                        calling/onboarding must NOT appear on the Sales Head dashboard. */}
                    {['SHO', 'SSHO', 'ADMIN', 'CEO', 'ACADEMIC_LEAD'].includes(userRole || '') && (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
                                    Pending Calls (Verified Students)
                                    <span className="badge badge-info">{stats.toCallList.length}</span>
                                </h3>
                            </div>

                            {stats.toCallList.length > 0 ? (
                                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                                    {stats.toCallList.map((student: any, index: number) => (
                                        <a
                                            key={student.id}
                                            href={`/dashboard/batch/${student.batch_id}`}
                                            style={{ textDecoration: 'none', color: 'inherit' }}
                                        >
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                padding: '1rem 1.5rem',
                                                borderBottom: index !== stats.toCallList.length - 1 ? '1px solid var(--border)' : 'none',
                                                transition: 'background 0.2s',
                                                background: 'var(--surface)'
                                            }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: '50%',
                                                        background: 'var(--primary-light)', color: 'var(--primary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {student.student_name?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{student.student_name}</div>
                                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                                            Batch: {student.batch_name}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <span className="badge badge-info">Call Student</span>
                                                    <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📞</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>All Calls Done!</div>
                                    <div>No verified students waiting for a call.</div>
                                </div>
                            )}
                        </>
                    )}

                </div>
            ) : (
                /* Default Admin / CEO View - FULL DASHBOARD */
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>

                        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                            <div className="kpi-label">Total Batches</div>
                            <div className="kpi-value">{stats.totalBatches}</div>
                        </div>

                        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                            <div className="kpi-label">Total Students</div>
                            <div className="kpi-value">{stats.totalStudents}</div>
                        </div>

                        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                            <div className="kpi-label">Top Course</div>
                            <div className="kpi-value" style={{ fontSize: '1.15rem' }}>{stats.mostPopularCourse || '—'}</div>
                        </div>

                        <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                            <div className="kpi-label">Top Salesperson</div>
                            <div className="kpi-value" style={{ fontSize: '1.15rem' }}>{stats.topSalesPerson}</div>
                        </div>
                    </div>

                    {/* Revenue Dashboard (SRS Doc 2 §1 "Revenue Dashboard" / Doc 2 §3 Business Head) */}
                    {revenue && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                                <div className="kpi-label">Total Revenue</div>
                                <div className="kpi-value">₹{revenue.total.toLocaleString()}</div>
                            </div>
                            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                                <div className="kpi-label">Revenue Collected</div>
                                <div className="kpi-value" style={{ color: 'var(--success)' }}>₹{revenue.collected.toLocaleString()}</div>
                            </div>
                            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                                <div className="kpi-label">Outstanding</div>
                                <div className="kpi-value" style={{ color: 'var(--warning)' }}>₹{revenue.pending.toLocaleString()}</div>
                            </div>
                            <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                                <div className="kpi-label">Collection %</div>
                                <div className="kpi-value">{revenue.collection_percentage}%</div>
                            </div>
                        </div>
                    )}

                    {/* Payment Dashboard */}
                    {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && analytics?.payment_status_counts && (
                        <div className="card" style={{ marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>Payment Dashboard</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                                {['full', 'advance', 'partial', 'emi'].map(status => (
                                    <div key={status} style={{ padding: '0.85rem 1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                        <div className="kpi-label" style={{ textTransform: 'capitalize' }}>{status} Payment Students</div>
                                        <div className="kpi-value" style={{ fontSize: '1.25rem' }}>{analytics.payment_status_counts[status] || 0}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Batches per Course</h3>
                            <div style={{ height: '300px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                    <BarChart data={stats.batchesPerCourse}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                            cursor={{ fill: 'var(--surface-hover)' }}
                                        />
                                        <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="card">
                            <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Course Distribution</h3>
                            <div style={{ height: '300px', width: '100%' }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                    <PieChart>
                                        <Pie
                                            data={stats.batchesPerCourse}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            dataKey="count"
                                            label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                        >
                                            {stats.batchesPerCourse.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                    </div>

                    {/* School Distribution Chart for Admin/CEO */}
                    {
                        ['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && (
                            <div className="card" style={{ marginBottom: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Batches per School</h3>
                                <div style={{ height: '300px', width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                        <BarChart data={stats.batchesPerSchool}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                                cursor={{ fill: 'var(--surface-hover)' }}
                                            />
                                            <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )
                    }

                    {/* Sales Performance Row */}
                    {
                        ['CEO', 'SALES_HEAD', 'ADMIN', 'BUSINESS_HEAD'].includes(userRole || '') && (
                            <div className="card">
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Star Sales Performance (Top 5)</h3>
                                <div style={{ height: '300px', width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                        <BarChart data={stats.salesPerformance} layout="vertical" margin={{ left: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                            <XAxis type="number" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                                            <Tooltip
                                                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                                cursor={{ fill: 'var(--surface-hover)' }}
                                            />
                                            <Bar dataKey="count" fill="#ec4899" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )
                    }

                    {/* Student Analytics */}
                    {['ADMIN', 'CEO', 'BUSINESS_HEAD', 'SALES_HEAD'].includes(userRole || '') && analytics && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>

                            {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && (
                                <div className="card">
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Student Age Distribution</h3>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <BarChart data={Object.entries(analytics.age_bracket || {}).map(([name, count]) => ({ name, count }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                                <Bar dataKey="count" fill="#0088FE" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && (
                                <div className="card">
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Gender Breakdown</h3>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <PieChart>
                                                <Pie
                                                    data={Object.entries(analytics.gender || {}).map(([name, value]) => ({ name, value }))}
                                                    cx="50%" cy="50%" outerRadius={90} dataKey="value"
                                                    label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                                >
                                                    {Object.keys(analytics.gender || {}).map((_, index) => (
                                                        <Cell key={`gender-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && Object.keys(analytics.admissions_by_region || {}).length > 0 && (
                                <div className="card">
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Admissions by Region</h3>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <BarChart data={Object.entries(analytics.admissions_by_region || {}).map(([name, count]) => ({ name, count }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                                <Bar dataKey="count" fill="#00C49F" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            <div className="card">
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Lead Source Breakdown</h3>
                                <div style={{ height: '260px', width: '100%' }}>
                                    <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                        <PieChart>
                                            <Pie
                                                data={Object.entries(analytics.lead_source || {}).map(([name, value]) => ({ name, value }))}
                                                cx="50%" cy="50%" outerRadius={90} dataKey="value"
                                                label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                            >
                                                {Object.keys(analytics.lead_source || {}).map((_, index) => (
                                                    <Cell key={`ls-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {revenue && analytics.payment_method_breakdown && (
                                <div className="card">
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Revenue by Payment Method</h3>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <BarChart data={Object.entries(analytics.payment_method_breakdown || {}).map(([name, v]: [string, any]) => ({ name, revenue: v.revenue }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                                <Bar dataKey="revenue" fill="#FF8042" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(userRole || '') && Object.keys(analytics.admission_trend || {}).length > 0 && (
                                <div className="card">
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Admission Trend</h3>
                                    <div style={{ height: '260px', width: '100%' }}>
                                        <ResponsiveContainer width="100%" height="100%" debounce={200}>
                                            <BarChart data={Object.entries(analytics.admission_trend || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} cursor={{ fill: 'var(--surface-hover)' }} />
                                                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {analytics.avg_turnaround_days !== null && analytics.avg_turnaround_days !== undefined && (
                                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Avg. Lead → Admission Turnaround</div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{analytics.avg_turnaround_days} days</div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

        </div >
    )
}
