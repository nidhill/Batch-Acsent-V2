import type { Request, Response, NextFunction } from 'express'
import { MulterError } from 'multer'
import { AuthError } from '../lib/mongoAuth'

/**
 * Central error handler — replaces the identical try/catch block that was copy-pasted at the
 * bottom of all 49 Next.js API route handlers:
 *   if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
 *   console.error(...); return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
 * Mounted last, after every router, in app.ts. Express 5 auto-forwards rejected async
 * handler promises here, so route handlers can just `throw` instead of catching manually.
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
    if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message })
        return
    }
    // The original admissions/[id]/documents route explicitly checked file.size and returned
    // a 400 "File must be under 5MB" — the port relies on multer's limits.fileSize instead,
    // which throws a MulterError here rather than a plain oversized-request 500. Map it back
    // to the same 400 the original gave.
    if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File must be under 5MB' })
        return
    }
    console.error(`${req.method} ${req.path} error:`, err)
    res.status(500).json({ error: 'Internal Server Error' })
}

/** Mounted after all routers to catch requests to unknown paths under /api. */
export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({ error: 'Not found' })
}
