import { Router } from 'express'
import { getDb } from '../lib/mongodb'
import { authenticate } from '../middleware/auth'

const router = Router()

// Reads the separate LMS/SHO application's own collections (pagevisits, auditlogs — no `ba_`
// prefix, a different app sharing this MongoDB database, see the LMS-vs-Batch-Ascent gap
// investigation). Read-only: Batch Ascent never writes into these collections. Restricted to
// ADMIN/CEO/BUSINESS_HEAD, same tier as the other cross-cutting reports.
router.get('/report', authenticate, async (req, res, next) => {
    try {
        const { profile } = req.auth!
        if (!['ADMIN', 'CEO', 'BUSINESS_HEAD'].includes(profile.role)) {
            res.status(403).json({ error: 'Forbidden' })
            return
        }

        const from = req.query.from as string | undefined
        const to = req.query.to as string | undefined
        const dateFilter: Record<string, any> = {}
        if (from) dateFilter.$gte = new Date(from)
        if (to) dateFilter.$lte = new Date(to)
        const match = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}

        const db = await getDb()
        const pagevisits = db.collection('pagevisits')

        const [totalVisits, uniqueUserIds, dateRangeAgg, byRole, topPages, topUsers, dailyTrend, loginCount] = await Promise.all([
            pagevisits.countDocuments(match),
            pagevisits.distinct('user', match),
            pagevisits.aggregate([
                { $match: match },
                { $group: { _id: null, min: { $min: '$createdAt' }, max: { $max: '$createdAt' } } },
            ]).toArray(),
            pagevisits.aggregate([
                { $match: match },
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]).toArray(),
            pagevisits.aggregate([
                { $match: match },
                { $group: { _id: { path: '$path', label: '$label' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]).toArray(),
            pagevisits.aggregate([
                { $match: match },
                { $group: { _id: { userName: '$userName', role: '$role' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]).toArray(),
            pagevisits.aggregate([
                { $match: match },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } },
            ]).toArray(),
            db.collection('auditlogs').countDocuments({ action: 'LOGIN', ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}) }),
        ])

        res.json({
            totalVisits,
            uniqueUsers: uniqueUserIds.length,
            totalLogins: loginCount,
            dateRange: dateRangeAgg[0] ? { from: dateRangeAgg[0].min, to: dateRangeAgg[0].max } : null,
            byRole: byRole.map(r => ({ role: r._id || 'unknown', count: r.count })),
            topPages: topPages.map(p => ({ path: p._id.path, label: p._id.label || p._id.path, count: p.count })),
            topUsers: topUsers.map(u => ({ userName: u._id.userName || 'Unknown', role: u._id.role, count: u.count })),
            dailyTrend: dailyTrend.map(d => ({ date: d._id, count: d.count })),
        })
    } catch (err) {
        next(err)
    }
})

export default router
