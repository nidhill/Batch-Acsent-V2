import type { Request, Response, NextFunction } from 'express'
import { requireUser, requireRole as requireRoleCheck, UserProfile } from '../lib/mongoAuth'

// Augment Express's Request type so `req.auth` is typed everywhere it's used.
declare global {
    namespace Express {
        interface Request {
            auth?: { authUserId: string; authEmail: string | null; profile: UserProfile }
        }
    }
}

/**
 * Express equivalent of every API route's old `const { authUserId, profile } = await
 * requireUser(request)` opening line. Verifies the Supabase bearer token and loads the Mongo
 * profile, attaching both to `req.auth`. Throws (via next(err)) straight to the central
 * errorHandler on failure — see middleware/error.ts.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
    try {
        req.auth = await requireUser(req.headers.authorization)
        next()
    } catch (err) {
        next(err)
    }
}

/** Express equivalent of the old inline `requireRole(profile, [...])` calls. Use after `authenticate`. */
export function requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            requireRoleCheck(req.auth!.profile, allowedRoles)
            next()
        } catch (err) {
            next(err)
        }
    }
}
