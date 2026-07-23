import * as XLSX from 'xlsx'

// Ported unchanged from src/lib/exportXlsx.ts — client-side .xlsx export.
export function exportToXlsx(filename: string, rows: Record<string, any>[], sheetName = 'Report') {
    if (!rows || rows.length === 0) {
        alert('No data to export.')
        return
    }
    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`)
}
