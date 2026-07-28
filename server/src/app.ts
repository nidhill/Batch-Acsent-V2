import express from 'express'
import cors from 'cors'
import path from 'path'
import { errorHandler, notFoundHandler } from './middleware/error'
import { getDb } from './lib/mongodb'
import authRouter from './routes/auth'
import admissionsRouter from './routes/admissions'
import batchesRouter from './routes/batches'
import coursesRouter from './routes/courses'
import schoolsRouter from './routes/schools'
import usersRouter from './routes/users'
import leadsRouter from './routes/leads'
import learnerAgreementsRouter from './routes/learnerAgreements'
import batchTransferRequestsRouter from './routes/batchTransferRequests'
import linkStudentRouter from './routes/linkStudent'
import regionsRouter from './routes/regions'
import salesTargetsRouter from './routes/salesTargets'
import analyticsRouter from './routes/analytics'
import verificationQueueRouter from './routes/verificationQueue'
import settingsRouter from './routes/settings'
import searchRouter from './routes/search'
import activityLogsRouter from './routes/activityLogs'
import logActivityRouter from './routes/logActivity'
import notificationsRouter from './routes/notifications'
import paymentsRouter from './routes/payments'
import adminUsersRouter from './routes/adminUsers'
import webhooksRouter from './routes/webhooks'
import cronRouter from './routes/cron'
import proxyRouter from './routes/proxy'

export function createApp() {
    const app = express()

    app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }))
    app.use(express.json())

    // Phase 0 foundation check — confirms Mongo connectivity without any auth/route logic yet.
    // Feature routers get mounted here incrementally in Phases 1-3 (see routes/ directory).
    app.get('/api/health', async (req, res) => {
        try {
            const db = await getDb()
            const userCount = await db.collection('ba_users').countDocuments()
            res.json({ ok: true, mongo: 'connected', ba_users_count: userCount })
        } catch (err: any) {
            res.status(500).json({ ok: false, error: err.message })
        }
    })

    // --- Feature routers mount here, one per Phase 1-3 batch ---
    app.use('/api/auth', authRouter)
    app.use('/api/admissions', admissionsRouter)
    app.use('/api/batches', batchesRouter)
    app.use('/api/courses', coursesRouter)
    app.use('/api/schools', schoolsRouter)
    app.use('/api/users', usersRouter)
    app.use('/api/leads', leadsRouter)
    app.use('/api/learner-agreements', learnerAgreementsRouter)
    app.use('/api/batch-transfer-requests', batchTransferRequestsRouter)
    app.use('/api/link-student', linkStudentRouter)
    app.use('/api/regions', regionsRouter)
    app.use('/api/sales-targets', salesTargetsRouter)
    app.use('/api/analytics', analyticsRouter)
    app.use('/api/verification-queue', verificationQueueRouter)
    app.use('/api/settings', settingsRouter)
    app.use('/api/search', searchRouter)
    app.use('/api/activity-logs', activityLogsRouter)
    app.use('/api/log-activity', logActivityRouter)
    app.use('/api/notifications', notificationsRouter)
    app.use('/api/payments', paymentsRouter)
    app.use('/api', adminUsersRouter)
    app.use('/api/webhooks', webhooksRouter)
    app.use('/api/cron', cronRouter)
    app.use('/api/proxy', proxyRouter)

    app.use('/api', notFoundHandler)

    // Production: serve the built SPA and fall back to it for client-side routing.
    if (process.env.NODE_ENV === 'production') {
        const clientDist = path.join(__dirname, '../public')
        app.use(express.static(clientDist))
        // Express 5's router (path-to-regexp v8) rejects a bare '*' — wildcard segments must
        // be named now, e.g. '*splat'. This is the SPA fallback: any non-API, non-static path
        // gets index.html so react-router-dom can handle the route client-side.
        app.get('/*splat', (req, res) => res.sendFile(path.join(clientDist, 'index.html')))
    }

    app.use(errorHandler)

    return app
}
