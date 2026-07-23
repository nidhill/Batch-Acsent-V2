import { MongoClient, Db } from 'mongodb'

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME || 'sho_app'

if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable')
}

// Ported from the Next.js app's src/lib/mongodb.ts. The original cached the client across
// Next.js dev hot-reloads via a global; that specific trick doesn't apply here since `tsx
// watch` restarts the whole process on file change (no persistent module cache to guard),
// so this is just a plain singleton for the process lifetime.
const clientPromise: Promise<MongoClient> = new MongoClient(uri).connect()

export default clientPromise

export async function getDb(): Promise<Db> {
    const client = await clientPromise
    return client.db(dbName)
}
