import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { authedFetch, API_BASE } from '@/lib/api'
import { UserPlus, Trash2, Filter, History, Search, UserX, UserCheck } from 'lucide-react'
import { SCHOOLS, ROLES } from '@/lib/constants'

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [savedId, setSavedId] = useState<string | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        role: 'SHO',
        school: '',
        region: ''
    })
    const [schoolsList, setSchoolsList] = useState<any[]>([])
    const [regionsList, setRegionsList] = useState<any[]>([])

    // Filter states
    const [filterSchool, setFilterSchool] = useState('ALL')
    const [filterRole, setFilterRole] = useState('ALL')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const res = await authedFetch('/api/users')
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setUsers((data.users || []).map((u: any) => ({ ...u, id: u._id })))
        } catch (error) {
            console.error('Error fetching users:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchSchools = async () => {
        try {
            const res = await authedFetch('/api/schools')
            const data = await res.json()
            const schools = (data.schools || []).map((s: any) => ({ ...s, id: s._id }))
            if (schools.length > 0) {
                setSchoolsList(schools)
                setNewUser(prev => ({ ...prev, school: schools[0].name }))
            } else {
                setSchoolsList(SCHOOLS.map(s => ({ name: s })))
                setNewUser(prev => ({ ...prev, school: SCHOOLS[0] }))
            }
        } catch (err) {
            console.error('Error fetching schools:', err)
            setSchoolsList(SCHOOLS.map(s => ({ name: s })))
        }
    }

    const fetchRegions = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/regions`)
            const data = await res.json()
            const regions = data.regions || []
            setRegionsList(regions)
            if (regions.length > 0) setNewUser(prev => ({ ...prev, region: regions[0]._id }))
        } catch (err) {
            console.error('Error fetching regions:', err)
        }
    }

    useEffect(() => {
        fetchUsers()
        fetchSchools()
        fetchRegions()
    }, [])

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const response = await authedFetch('/api/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newUser)
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to invite user')
            }

            alert(`User invited successfully! Supabase has sent an email to ${newUser.email}.`)
            setNewUser({ name: '', email: '', role: 'SHO', school: SCHOOLS[0], region: regionsList[0]?._id || '' })
            fetchUsers()
        } catch (error: any) {
            alert('Error inviting user: ' + error.message)
        }
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user? This will remove their login access.')) return

        try {
            const response = await authedFetch('/api/delete-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delete user')
            }

            fetchUsers()
        } catch (error: any) {
            alert('Error deleting user: ' + error.message)
        }
    }

    const handleToggleActive = async (user: any) => {
        const nextActive = user.is_active === false // currently inactive -> reactivating
        const verb = nextActive ? 'reactivate' : 'deactivate'
        if (!confirm(`Are you sure you want to ${verb} ${user.name}? ${nextActive ? 'They will regain login access.' : "They will immediately lose login access, but their students, admissions and payment history stay exactly as they are — nothing is deleted."}`)) return

        setTogglingId(user.id)
        try {
            const res = await authedFetch('/api/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: user.id, is_active: nextActive })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || `Failed to ${verb} user`)
            await fetchUsers()
        } catch (err: any) {
            alert(`Error: ${err.message}`)
        } finally {
            setTogglingId(null)
        }
    }

    // Deactivated users get their own section entirely, so the main list only ever shows
    // people who can currently log in.
    const deactivatedUsers = users.filter(user => user.is_active === false)

    // Apply filters
    const filteredUsers = users.filter(user => {
        if (user.is_active === false) return false
        const matchesSchool = filterSchool === 'ALL' || user.school === filterSchool
        const matchesRole = filterRole === 'ALL' || user.role === filterRole
        const q = searchQuery.trim().toLowerCase()
        const matchesSearch = !q ||
            user.name?.toLowerCase().includes(q) ||
            user.email?.toLowerCase().includes(q) ||
            user.sales_id?.toLowerCase().includes(q) ||
            user.cliq_id?.toLowerCase().includes(q)
        return matchesSchool && matchesRole && matchesSearch
    })

    return (
        <div className="animate-fade-in">
            <div className="card mb-8" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Add New User</h3>
                <form onSubmit={handleCreateUser} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <input
                        type="text"
                        placeholder="Full Name"
                        className="input"
                        value={newUser.name}
                        onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                        required
                    />
                    <input
                        type="email"
                        placeholder="Email"
                        className="input"
                        value={newUser.email}
                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        required
                    />

                    <select
                        className="input"
                        value={newUser.role}
                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    >
                        {Object.values(ROLES).map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>

                    {newUser.role !== 'ADMIN' && newUser.role !== 'CEO' && (
                        <select
                            className="input"
                            value={newUser.school}
                            onChange={e => setNewUser({ ...newUser, school: e.target.value as any })}
                        >
                            {SCHOOLS.map(school => (
                                <option key={school} value={school}>{school}</option>
                            ))}
                        </select>
                    )}

                    <select
                        className="input"
                        value={newUser.region}
                        onChange={e => setNewUser({ ...newUser, region: e.target.value })}
                    >
                        {regionsList.map(region => (
                            <option key={region._id} value={region._id}>{region.name}</option>
                        ))}
                    </select>

                    <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1' }}>
                        <UserPlus size={20} style={{ marginRight: '0.5rem' }} />
                        Invite User
                    </button>
                </form>
            </div>

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Existing Users ({filteredUsers.length})</h3>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                className="input"
                                placeholder="Search name, email, sales ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: '0.25rem 0.5rem 0.25rem 2rem', fontSize: '0.875rem', width: '220px' }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Filter size={16} color="var(--text-secondary)" />
                            <select
                                className="input"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                value={filterSchool}
                                onChange={(e) => setFilterSchool(e.target.value)}
                            >
                                <option value="ALL">All Schools</option>
                                {schoolsList.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <select
                                className="input"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            >
                                <option value="ALL">All Roles</option>
                                {Object.values(ROLES).map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '1rem', width: '50px' }}>Sl No</th>
                                <th style={{ padding: '1rem' }}>Name</th>
                                <th style={{ padding: '1rem' }}>Email</th>
                                <th style={{ padding: '1rem' }}>Role</th>
                                <th style={{ padding: '1rem' }}>School</th>
                                <th style={{ padding: '1rem' }}>Region</th>
                                <th style={{ padding: '1rem' }}>Sales ID</th>
                                <th style={{ padding: '1rem' }}>Cliq ID</th>
                                <th style={{ padding: '1rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, index) => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', color: 'var(--text-tertiary)' }}>{index + 1}</td>
                                    <td style={{ padding: '1rem' }}>{user.name}</td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <select
                                            className="input"
                                            value={user.role}
                                            onChange={(e) => {
                                                const newRole = e.target.value
                                                setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u))
                                            }}
                                            style={{ padding: '0.25rem', fontSize: '0.875rem' }}
                                        >
                                            {Object.values(ROLES).map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <select
                                            className="input"
                                            value={user.school || ''}
                                            onChange={(e) => {
                                                const newSchool = e.target.value
                                                setUsers(users.map(u => u.id === user.id ? { ...u, school: newSchool } : u))
                                            }}
                                            style={{ padding: '0.25rem', fontSize: '0.875rem', maxWidth: '150px' }}
                                        >
                                            <option value="">-</option>
                                            {schoolsList.map(school => (
                                                <option key={school.id || school.name} value={school.name}>{school.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <select
                                            className="input"
                                            value={user.region || ''}
                                            onChange={(e) => {
                                                const newRegion = e.target.value
                                                setUsers(users.map(u => u.id === user.id ? { ...u, region: newRegion } : u))
                                            }}
                                            style={{ padding: '0.25rem', fontSize: '0.875rem', maxWidth: '130px' }}
                                        >
                                            <option value="">-</option>
                                            {regionsList.map(region => (
                                                <option key={region._id} value={region._id}>{region.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <input
                                            type="text"
                                            className="input"
                                            value={user.sales_id || ''}
                                            onChange={(e) => {
                                                const newId = e.target.value
                                                setUsers(users.map(u => u.id === user.id ? { ...u, sales_id: newId } : u))
                                            }}
                                            style={{ padding: '0.25rem', fontSize: '0.875rem', width: '100px' }}
                                            placeholder="-"
                                        />
                                    </td>
                                    <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{user.cliq_id || '-'}</td>
                                    <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <button
                                            disabled={savingId === user.id}
                                            onClick={async () => {
                                                setSavingId(user.id)
                                                setSavedId(null)
                                                try {
                                                    const res = await authedFetch('/api/update-user', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            id: user.id,
                                                            role: user.role,
                                                            school: user.school || null,
                                                            region: user.region || null,
                                                            sales_id: user.sales_id || null
                                                        })
                                                    })
                                                    const data = await res.json()
                                                    if (!res.ok) throw new Error(data.error || 'Failed to save')

                                                    setSavedId(user.id)
                                                    setTimeout(() => setSavedId(null), 2000)
                                                    await fetchUsers()
                                                } catch (err: any) {
                                                    alert('Error: ' + err.message)
                                                } finally {
                                                    setSavingId(null)
                                                }
                                            }}
                                            style={{
                                                padding: '0.25rem 0.75rem',
                                                fontSize: '0.75rem',
                                                marginRight: '0.5rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: savedId === user.id ? '#16a34a' : 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                cursor: savingId === user.id ? 'not-allowed' : 'pointer',
                                                opacity: savingId === user.id ? 0.7 : 1,
                                                transition: 'background 0.3s',
                                                fontWeight: '600'
                                            }}
                                        >
                                            {savingId === user.id ? 'Saving...' : savedId === user.id ? '✓ Saved' : 'Save'}
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const cliqId = prompt('Enter Cliq ID:', user.cliq_id || '')
                                                if (cliqId === null) return
                                                // ... existing Cliq ID logic is separate, or we can merge it.
                                                // For now keeping it separate as getting too complex in one step
                                                try {
                                                    const res = await authedFetch('/api/update-user', {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json'
                                                        },
                                                        body: JSON.stringify({
                                                            id: user.id,
                                                            cliq_id: cliqId
                                                        })
                                                    })
                                                    if (!res.ok) throw new Error('Failed to update')
                                                    await fetchUsers()
                                                } catch (err) { alert('Error updating Cliq ID') }
                                            }}
                                            className="btn-secondary"
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                            title="Set Cliq ID"
                                        >
                                            ID
                                        </button>
                                        <Link
                                            to={`/dashboard/admin/users/${user.id}/history`}
                                            style={{ color: 'var(--text-secondary)', display: 'inline-flex' }}
                                            title="View login/activity history"
                                        >
                                            <History size={18} />
                                        </Link>
                                        <button
                                            disabled={togglingId === user.id}
                                            onClick={() => handleToggleActive(user)}
                                            style={{
                                                background: 'none', border: 'none', cursor: togglingId === user.id ? 'not-allowed' : 'pointer',
                                                color: 'var(--warning)',
                                                opacity: togglingId === user.id ? 0.5 : 1,
                                            }}
                                            title="Deactivate (revoke login access, keep all their data)"
                                        >
                                            <UserX size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                            title="Permanently delete (removes login + profile; sales_id on their past admissions becomes unattributed)"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {deactivatedUsers.length > 0 && (
                <div className="card" style={{ marginTop: '2rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>Deactivated Users ({deactivatedUsers.length})</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        No login access. Their students, admissions and payment history are untouched — reactivate to restore access.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '1rem' }}>Name</th>
                                    <th style={{ padding: '1rem' }}>Email</th>
                                    <th style={{ padding: '1rem' }}>Role</th>
                                    <th style={{ padding: '1rem' }}>School</th>
                                    <th style={{ padding: '1rem' }}>Sales ID</th>
                                    <th style={{ padding: '1rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {deactivatedUsers.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>{user.name}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{user.email}</td>
                                        <td style={{ padding: '1rem' }}>{user.role}</td>
                                        <td style={{ padding: '1rem' }}>{user.school || '-'}</td>
                                        <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{user.sales_id || '-'}</td>
                                        <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <button
                                                disabled={togglingId === user.id}
                                                onClick={() => handleToggleActive(user)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: togglingId === user.id ? 'not-allowed' : 'pointer', opacity: togglingId === user.id ? 0.6 : 1 }}
                                                title="Reactivate (restore login access)"
                                            >
                                                <UserCheck size={16} /> Reactivate
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                                title="Permanently delete (removes login + profile; sales_id on their past admissions becomes unattributed)"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
