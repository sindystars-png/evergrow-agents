@AGENTS.md

## Project Commands

```bash
npm run dev        # Next.js dev server
npm run build      # Production build
npm run lint       # ESLint checks
npm run start      # Start via server.js
npm run start:next # Start with next start
```

## Runtime Notes
- Node version: `20.x` (from `package.json` engines).
- App is Next.js (`next@15.x`) with custom `server.js` startup path available.
- No `test` script is currently defined in `package.json`.

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_TENANT_ID`
- `CRON_SECRET`

## Architecture Snapshot
- `src/app/` App Router pages, route groups, and API routes.
- `src/components/` shared UI components.
- `src/lib/` utilities and integrations.
- `supabase/` Supabase-related config/artifacts.

## Gotchas
- Follow `AGENTS.md` guidance for this Next.js version before framework-level edits.
- Prefer `npm run start` when behavior depends on `server.js`; use `start:next` only when explicitly needed.

## Scheduling / Cron Behavior
- Persistent Node runtime (`npm run start`) schedules jobs inside `server.js`:
  - Daily at 8:00 AM CT (`0 14 * * *`) -> `/api/cron/execute-tasks`
  - Every 15 minutes (`*/15 * * * *`) sweep for newly due tasks
- `vercel.json` also defines a daily cron for `/api/cron/execute-tasks`; keep schedules aligned across deployment targets.
