# Batch Ascent V2

Admissions & batch management system for Haris & Co Academy (HACA). Sales reps enroll
students into batches, Academic Leads/Sales Heads verify and manage them, and
Admin/CEO/Business Head get revenue and operations dashboards on top.

This is a **MERN port** of an earlier Next.js + Supabase app (the `Batch-Ascent` folder
next to this one). The UI/business logic is carried over 1:1 — same pages, same role
rules — just re-hosted on Express + MongoDB instead of Next.js API routes + Postgres.

## Tech stack

| | |
|---|---|
| Frontend | Vite + React 19 + TypeScript, React Router, CSS Modules |
| Backend | Express 5 + TypeScript, MongoDB driver (no ORM) |
| Auth | Supabase Auth (email/password) — Mongo stores the profile, Supabase only handles login/session |
| Hosting | Client + server both on Vercel (`vercel.json`), server also deployable to Render |
| Charts | Recharts |

## Repo layout

```
server/               Express API
  src/routes/          one file per resource — auth, admissions, batches, analytics, ...
  src/lib/              permissions.ts (role → permission matrix), mongodb.ts, mongoAuth.ts
  src/middleware/       authenticate (verifies Supabase token, loads Mongo profile), error handler

client/               Vite + React SPA
  src/pages/            top-level routes (LoginPage, SignupPage, ...)
  src/pages/dashboard/   everything under /dashboard — one file per page, role-gated in the nav
  src/components/       shared widgets (GlobalSearch, DashboardFilterBar, MiniCalendar, ...)
  src/lib/               api.ts (authedFetch — attaches the Supabase token to every request),
                         supabaseClient.ts, constants.ts (roles, schools, payment methods, ...)
```

## Getting started

Both `server/` and `client/` need their own `.env` (copy `.env.example` in each folder).

```bash
# server
cd server
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_ANON_KEY, MONGODB_URI (see below)
npm install
npm run dev             # http://localhost:4000

# client (separate terminal)
cd client
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — same Supabase project as server
npm install
npm run dev             # http://localhost:5173, proxies /api to the server in dev
```

Ask a teammate for the real `SUPABASE_URL`/`SUPABASE_ANON_KEY` and `MONGODB_URI` — these
point at shared staging infra, not something you spin up locally.

Useful scripts:
- `npm run typecheck` (server) / `tsc -b` via `npm run build` (client) — run before pushing
- `npm run build` (server) — compiles to `dist/`
- `npm run dev` in both — hot reload

## The most important thing to understand: roles & permissions

Every user has exactly one role, stored on their Mongo profile (`ba_users` collection):
`ADMIN`, `CEO`, `BUSINESS_HEAD`, `ACADEMIC_LEAD`, `SALES_HEAD`, `SALES` (displayed in the
UI as "Sales Lead" and "Sales Executive" respectively — the underlying value is unchanged).
`SHO`/`SSHO` used to exist here but that workflow moved entirely to a separate "SHO app";
those roles are now rejected at login.

Roles are enforced in **two places** — both matter, neither alone is enough:

1. **Client-side** — `client/src/pages/dashboard/DashboardLayout.tsx` has a `navItems` array
   with a `roles: [...]` list per page. This only controls what shows up in the sidebar; it's
   not real security (anyone can hit a URL directly).
2. **Server-side** — `server/src/lib/permissions.ts` has a `PERMISSIONS` map
   (e.g. `CREATE_EDIT_BATCH: [ROLES.ADMIN, ROLES.CEO, ROLES.ACADEMIC_LEAD]`) checked via
   `can(role, 'PERMISSION_NAME')` inside route handlers. **This is the real gate.** If you
   add a new restricted action, it needs an entry here, not just a hidden nav item.

When changing who can do what, grep for the permission name in `permissions.ts` first —
it's the single source of truth.

## Auth flow

Login/signup go through Supabase Auth (`supabase.auth.signInWithPassword` /
`.signUp()` client-side). That only gets you a Supabase session — every API call then
carries the Supabase access token as a Bearer header (`client/src/lib/api.ts`'s
`authedFetch`), and the server's `authenticate` middleware
(`server/src/middleware/auth.ts` → `lib/mongoAuth.ts`) verifies that token with Supabase
and loads the matching profile from `ba_users` in Mongo. **The Mongo profile is the
source of truth for role/school/permissions** — Supabase only proves "this person can log
in."

New signups land with `role: PENDING` until an Admin approves them
(`/dashboard/admin/approve-users`).

## Database notes (read this before writing any Mongo query)

- The Mongo database (`sho_app`) is **shared with a separate, separately-owned LMS/SHO
  app**. This app's own collections are all prefixed `ba_` (`ba_users`, `ba_admissions`,
  `ba_batches`, `ba_payments`, `ba_activity_logs`, ...) — never touch the un-prefixed
  collections (`users`, `students`, `courses`, ...), those belong to the other app.
- `server/src/index.ts` runs a background job every 5 minutes that syncs newer rows from
  the old Next.js app's Supabase Postgres database into these Mongo collections — that
  Next.js app is still receiving some writes, so this isn't fully decommissioned yet.
- Payment records (`ba_payments`, `ba_payment_transactions`) are a newer feature with no
  historical backfill — don't be surprised if revenue dashboards show ₹0 on
  older/pre-existing admissions; that's expected, not a bug.

## Where to look for common tasks

- **Add/change a dashboard page**: `client/src/pages/dashboard/`, then register the route
  in `client/src/App.tsx` and (if it needs a nav entry) `DashboardLayout.tsx`'s `navItems`.
- **Add/change an API endpoint**: pick the right file in `server/src/routes/`, or add a new
  one and mount it in `server/src/app.ts`.
- **Change what a role can do**: `server/src/lib/permissions.ts` (real enforcement) +
  `DashboardLayout.tsx` `navItems` (what shows in the sidebar).
- **Add a new role-visible label**: role display names (e.g. "Sales Executive" instead of
  the raw `SALES` value) are formatted in `DashboardLayout.tsx` and `ProfilePage.tsx`
  (`formatRole`/`ROLE_LABELS`) — the underlying role string in the database never changes.

## Deployment

- `vercel.json` at the repo root builds and deploys both client and server together.
- The server also runs standalone on Render for some environments — if you touch anything
  latency-sensitive, remember free-tier services there cold-start after ~15 min idle.
