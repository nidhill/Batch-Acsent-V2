import { Router } from 'express'
import { authenticate } from '../middleware/auth'

const router = Router()

// Server-side proxy for countrystatecity.in — Student Admission's Region -> State -> City
// cascade. The key is never sent to the browser: the client calls these two routes, which
// attach X-CSCAPI-KEY here. If CSC_API_KEY isn't configured, both return an empty list so the
// client falls back to its bundled India/UAE list in lib/locationData.ts instead of breaking.
const CSC_BASE = 'https://api.countrystatecity.in/v1'

router.get('/states', authenticate, async (req, res, next) => {
    try {
        const apiKey = process.env.CSC_API_KEY
        const country = (req.query.country as string || '').trim()
        if (!apiKey || !country) {
            res.json({ states: [] })
            return
        }

        const response = await fetch(`${CSC_BASE}/countries/${encodeURIComponent(country)}/states`, {
            headers: { 'X-CSCAPI-KEY': apiKey },
        })
        if (!response.ok) {
            res.json({ states: [] })
            return
        }
        const data = await response.json() as any[]
        res.json({ states: (data || []).map((s: any) => ({ name: s.name, iso2: s.iso2 })) })
    } catch (err) {
        console.error('locations/states error:', err)
        res.json({ states: [] })
    }
})

router.get('/cities', authenticate, async (req, res, next) => {
    try {
        const apiKey = process.env.CSC_API_KEY
        const country = (req.query.country as string || '').trim()
        const state = (req.query.state as string || '').trim()
        if (!apiKey || !country || !state) {
            res.json({ cities: [] })
            return
        }

        const response = await fetch(`${CSC_BASE}/countries/${encodeURIComponent(country)}/states/${encodeURIComponent(state)}/cities`, {
            headers: { 'X-CSCAPI-KEY': apiKey },
        })
        if (!response.ok) {
            res.json({ cities: [] })
            return
        }
        const data = await response.json() as any[]
        res.json({ cities: (data || []).map((c: any) => c.name) })
    } catch (err) {
        console.error('locations/cities error:', err)
        res.json({ cities: [] })
    }
})

export default router
