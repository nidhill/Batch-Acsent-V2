import { getSupabaseAdmin } from './supabaseAdmin'
import { getDb } from './mongodb'

// The original Next.js app (still live in production) writes to Supabase Postgres, but this
// app's data layer is MongoDB — a one-time migration (see Batch-Ascent/scripts/migrate_to_mongo.ts)
// copied Postgres into `ba_*` Mongo collections, and the old app has kept writing new real data
// to Supabase ever since. This keeps Mongo caught up automatically.
//
// Insert-only by design: every row is written via $setOnInsert + upsert:true, which is a
// complete no-op on any document that already exists in Mongo. This is deliberate — the
// original migration script's own header warns that a full replaceOne re-sync would revert
// Phase-B changes made directly in Mongo since (e.g. the PROJECT_LEAD -> BUSINESS_HEAD role
// rename). Only rows missing from Mongo are ever written; existing documents are never touched.
const TABLE_COLLECTION_MAP: { table: string; collection: string }[] = [
    { table: 'batches', collection: 'ba_batches' },
    { table: 'courses', collection: 'ba_courses' },
    { table: 'users', collection: 'ba_users' },
    { table: 'students', collection: 'ba_students' },
    { table: 'student_batches', collection: 'ba_student_batches' },
    { table: 'sales_enrollments', collection: 'ba_admissions' },
]

async function fetchAllRows(table: string, pageSize = 1000): Promise<any[]> {
    const supabase = getSupabaseAdmin()
    let all: any[] = []
    let from = 0
    while (true) {
        const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        if (!data || data.length === 0) break
        all = all.concat(data)
        if (data.length < pageSize) break
        from += pageSize
    }
    return all
}

export interface SyncResult {
    table: string
    collection: string
    inSupabase: number
    alreadyInMongo: number
    inserted: number
}

export async function syncFromSupabase(): Promise<SyncResult[]> {
    const db = await getDb()
    const results: SyncResult[] = []

    for (const { table, collection } of TABLE_COLLECTION_MAP) {
        const rows = await fetchAllRows(table)
        const existingIds = new Set(
            (await db.collection(collection).find({}).project({ _id: 1 }).toArray()).map(d => d._id)
        )
        const missing = rows.filter(r => !existingIds.has(r.id))

        let inserted = 0
        if (missing.length > 0) {
            const ops = missing.map(row => ({
                updateOne: {
                    filter: { _id: row.id },
                    update: { $setOnInsert: { ...row, _id: row.id } },
                    upsert: true,
                },
            }))
            const result = await db.collection(collection).bulkWrite(ops, { ordered: false })
            inserted = result.upsertedCount
        }

        results.push({ table, collection, inSupabase: rows.length, alreadyInMongo: existingIds.size, inserted })
    }

    return results
}
