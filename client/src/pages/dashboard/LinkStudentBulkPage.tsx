import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { authedFetch } from '@/lib/api'
import { Upload, Plus, Trash, ArrowLeft } from 'lucide-react'
import { SCHOOLS } from '@/lib/constants'

interface Batch {
    id: string
    name: string
    mode: string
    school: string
    course: string
}

interface SalesPerson {
    id: string
    name: string
    sales_id: string
    school: string
}

interface StudentRow {
    id: number
    name: string
    email: string
    phone: string
    salesId: string // Individual override
    status: 'pending' | 'success' | 'error'
    message?: string
    generatedId?: string
}

export default function LinkStudentBulkPage() {
    const navigate = useNavigate()
    const [batches, setBatches] = useState<Batch[]>([])
    const [salesPersons, setSalesPersons] = useState<SalesPerson[]>([])

    // Global Selections
    const [selectedSchool, setSelectedSchool] = useState('ALL')
    const [selectedBatchId, setSelectedBatchId] = useState('')
    const [globalSalesId, setGlobalSalesId] = useState('')

    // Data Rows
    const [rows, setRows] = useState<StudentRow[]>([
        { id: 1, name: '', email: '', phone: '', salesId: '', status: 'pending' }
    ])

    const [processing, setProcessing] = useState(false)

    useEffect(() => {
        fetchMetadata()
    }, [])

    const fetchMetadata = async () => {
        const batchRes = await authedFetch('/api/batches?view=all')
        const batchData = await batchRes.json()
        if (batchData.batches) setBatches(batchData.batches)

        const salesRes = await authedFetch('/api/users?directory=1&role=SALES')
        const salesData = await salesRes.json()
        if (salesData.users) setSalesPersons(salesData.users.map((u: any) => ({ ...u, id: u._id })))
    }

    // Filter Batches by School
    const filteredBatches = batches.filter(b => selectedSchool === 'ALL' || b.school === selectedSchool)

    // Filter Sales Persons (Global) - usually refined by selected Batch's school
    const selectedBatch = batches.find(b => b.id === selectedBatchId)
    const filteredSalesPersons = salesPersons.filter(person => {
        if (selectedBatch && selectedBatch.school) {
            return !person.school || person.school === selectedBatch.school
        }
        return true
    })

    const addRow = () => {
        setRows(prev => [
            ...prev,
            { id: Date.now(), name: '', email: '', phone: '', salesId: '', status: 'pending' }
        ])
    }

    const updateRow = (id: number, field: keyof StudentRow, value: string) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    }

    const removeRow = (id: number) => {
        setRows(prev => prev.filter(r => r.id !== id))
    }

    // CSV Handling
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            if (!text) return

            const lines = text.split('\n').map(line => line.trim()).filter(line => line)
            if (lines.length < 2) {
                alert('CSV appears to be empty or missing data.')
                return
            }

            // Simple header detection
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim())
            const nameIdx = headers.findIndex(h => h.includes('name'))
            const emailIdx = headers.findIndex(h => h.includes('email'))
            const phoneIdx = headers.findIndex(h => h.includes('phone'))

            if (nameIdx === -1 || emailIdx === -1) {
                alert('CSV must contain at least "Name" and "Email" columns.')
                return
            }

            const newRows: StudentRow[] = []

            for (let i = 1; i < lines.length; i++) {
                // Determine split char (handle simple cases)
                // Note: Standard CSV doesn't strictly trim spaces after comma, but we'll be lenient
                const columns = lines[i].split(',').map(c => c.trim())
                if (columns.length < 2) continue

                newRows.push({
                    id: Date.now() + i,
                    name: columns[nameIdx] || '',
                    email: columns[emailIdx] || '',
                    phone: phoneIdx !== -1 ? columns[phoneIdx] || '' : '',
                    salesId: '',
                    status: 'pending'
                })
            }

            setRows(prev => [...prev.filter(r => r.name || r.email), ...newRows])
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const downloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,Name,Email,Phone\nJohn Doe,john@example.com,9876543210"
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", "student_template.csv")
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const processBulkLink = async () => {
        if (!selectedBatchId) {
            alert('Please select a batch first.')
            return
        }

        // Validate rows
        const validRows = rows.filter(r => r.name && r.email)
        if (validRows.length === 0) {
            alert('Please add at least one student with Name and Email.')
            return
        }

        if (!globalSalesId && validRows.some(r => !r.salesId)) {
            alert('Please select a Global Sales Executive or assign one to every student row.')
            return
        }

        setProcessing(true)

        // Get Session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            alert('Session expired. Please login again.')
            setProcessing(false)
            return
        }

        // Process sequentially to be safe
        for (const row of rows) {
            if (!row.name || !row.email) continue; // Skip empty
            if (row.status === 'success') continue; // Skip already done

            // Determine Sales ID
            const salesExecId = row.salesId || globalSalesId

            try {
                const response = await authedFetch('/api/link-student', {
                    method: 'POST',
                    body: JSON.stringify({
                        student_name: row.name,
                        student_email: row.email,
                        student_phone: row.phone,
                        batch_id: selectedBatchId,
                        sales_user_id: salesExecId
                    })
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Failed')
                }

                // Success
                const genId = data.generated_id || data.student?.student_id || 'Linked'
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'success', generatedId: genId, message: 'Success' } : r))

            } catch (error: any) {
                setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', message: error.message } : r))
            }
        }

        setProcessing(false)
    }

    return (
        <div className="animate-fade-in" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Bulk Link Students</h1>
                <button
                    onClick={() => navigate('/dashboard/link-student')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.875rem' }}
                >
                    <ArrowLeft size={16} style={{ marginRight: '0.5rem' }} /> Single Link Mode
                </button>
            </div>

            {/* 1. Configuration Card */}
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                    1. Target Configuration
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>

                    {/* School Filter */}
                    <div>
                        <label className="label">Filter Batches by School</label>
                        <select
                            className="input"
                            value={selectedSchool}
                            onChange={(e) => { setSelectedSchool(e.target.value); setSelectedBatchId(''); }}
                        >
                            <option value="ALL">All Schools</option>
                            {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Batch Selection */}
                    <div>
                        <label className="label">Target Batch (Course)</label>
                        <select
                            className="input"
                            value={selectedBatchId}
                            onChange={(e) => setSelectedBatchId(e.target.value)}
                            style={{ border: selectedBatchId ? '1px solid var(--primary)' : '' }}
                        >
                            <option value="">Select a Batch...</option>
                            {filteredBatches.map(b => (
                                <option key={b.id} value={b.id}>
                                    {b.name} ({b.course}) - {b.mode}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Global Sales Exec */}
                    <div>
                        <label className="label">Default Sales Executive</label>
                        <select
                            className="input"
                            value={globalSalesId}
                            onChange={(e) => setGlobalSalesId(e.target.value)}
                        >
                            <option value="">-- Apply per student --</option>
                            {filteredSalesPersons.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.school})</option>
                            ))}
                        </select>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                            Can be overridden per row.
                        </p>
                    </div>

                </div>
            </div>

            {/* 2. Students Data Grid */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>2. Student Data</h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={downloadTemplate}
                            style={{ fontSize: '0.875rem', color: 'var(--primary)', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                            Download CSV Template
                        </button>

                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="csv-upload"
                        />
                        <label
                            htmlFor="csv-upload"
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <Upload size={16} /> Upload CSV
                        </label>

                        <button onClick={addRow} className="btn" style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                            <Plus size={16} style={{ marginRight: '0.25rem' }} /> Add Row
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem', width: '25%' }}>Full Name *</th>
                                <th style={{ padding: '0.75rem', width: '25%' }}>Email *</th>
                                <th style={{ padding: '0.75rem', width: '20%' }}>Phone</th>
                                <th style={{ padding: '0.75rem', width: '20%' }}>Sales Exec (Override)</th>
                                <th style={{ padding: '0.75rem', width: '50px' }}></th>
                                <th style={{ padding: '0.75rem', width: '10%' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="Student Name"
                                            value={row.name}
                                            onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                                            style={{ fontSize: '0.875rem' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            type="email"
                                            className="input"
                                            placeholder="email@example.com"
                                            value={row.email}
                                            onChange={(e) => updateRow(row.id, 'email', e.target.value)}
                                            style={{ fontSize: '0.875rem' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <input
                                            type="tel"
                                            className="input"
                                            placeholder="Phone"
                                            value={row.phone}
                                            onChange={(e) => updateRow(row.id, 'phone', e.target.value)}
                                            style={{ fontSize: '0.875rem' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        <select
                                            className="input"
                                            value={row.salesId}
                                            onChange={(e) => updateRow(row.id, 'salesId', e.target.value)}
                                            style={{ fontSize: '0.875rem', color: row.salesId ? 'var(--primary)' : 'inherit' }}
                                        >
                                            <option value="">{globalSalesId ? '(Use Default)' : 'Select...'}</option>
                                            {filteredSalesPersons.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => removeRow(row.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                                            className="hover:text-red-500"
                                            title="Remove Row"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </td>
                                    <td style={{ padding: '0.5rem' }}>
                                        {row.status === 'success' && (
                                            <div style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: '600' }}>
                                                {row.generatedId}
                                            </div>
                                        )}
                                        {row.status === 'error' && (
                                            <div style={{ color: 'var(--error)', fontSize: '0.75rem' }} title={row.message}>
                                                Error
                                            </div>
                                        )}
                                        {row.status === 'pending' && <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>-</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        onClick={addRow}
                        className="btn"
                        style={{ border: '1px solid var(--border)', background: 'transparent' }}
                    >
                        Add Another Row
                    </button>
                    <button
                        onClick={processBulkLink}
                        disabled={processing || !selectedBatchId}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 2rem', minWidth: '200px' }}
                    >
                        {processing ? 'Processing Students...' : `Link ${rows.filter(r => r.name).length} Students`}
                    </button>
                </div>
            </div>
        </div>
    )
}
