import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Ported unchanged from src/lib/exportPdf.ts — client-side, tabular PDF export.
export function exportToPdf(filename: string, rows: Record<string, any>[], title = 'Report') {
    if (!rows || rows.length === 0) {
        alert('No data to export.')
        return
    }
    const headerSet = new Set<string>()
    rows.forEach(row => Object.keys(row).forEach(k => headerSet.add(k)))
    const headers = Array.from(headerSet)

    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' })
    doc.setFontSize(14)
    doc.text(title, 14, 15)
    doc.setFontSize(9)
    doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21)

    autoTable(doc, {
        startY: 26,
        head: [headers.map(h => h.replace(/_/g, ' '))],
        body: rows.map(row => headers.map(h => {
            const v = row[h]
            if (v === null || v === undefined) return ''
            return typeof v === 'object' ? JSON.stringify(v) : String(v)
        })),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`)
}
