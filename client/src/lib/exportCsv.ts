/**
 * Ported unchanged from src/lib/exportCsv.ts — pure browser code (Blob/URL.createObjectURL),
 * zero framework dependency, no port changes needed.
 */
export function exportToCsv(filename: string, rows: Record<string, any>[]) {
    if (!rows || rows.length === 0) {
        alert('No data to export.')
        return
    }

    const headerSet = new Set<string>()
    rows.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)))
    const headers = Array.from(headerSet)

    const escapeCell = (value: any) => {
        if (value === null || value === undefined) return ''
        const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
        return str
    }

    const csv = [
        headers.join(','),
        ...rows.map(row => headers.map(h => escapeCell(row[h])).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
