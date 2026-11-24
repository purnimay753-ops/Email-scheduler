# Progress

## Phase 1 — Infra, config, schema
- [x] docker-compose: Postgres, Redis AOF, Elasticsearch single-node
- [x] Backend skeleton, zod config, pino, Prisma schema
- [x] Initial migration `backend/prisma/migrations/20261124100000_init`

## Phase 2 — Auth and schedule API
- [x] Google OAuth, httpOnly JWT cookie, logout, `/auth/me`
- [x] `POST /api/campaigns/schedule` (zod, dedupe, transaction, BullMQ delayed jobs, jobId = email id)
- [x] `POST /api/csv/parse`, `GET /api/emails`, `GET /api/senders`, Ethereal provision

## Phase 3 — Worker, limits, Slack, search
- [x] Worker entrypoint, concurrency from env, graceful shutdown
- [x] Per-sender min delay (Redis Lua), hourly counters `rate:{senderId}:{YYYYMMDDHH}`
- [x] Overflow reschedules with `moveToDelayed` (not a failed attempt)
- [x] Idempotent claim `scheduled -> processing`, messageId stored before `sent`
- [x] Boot reconciliation (once, Redis lock)
- [x] Slack OAuth + deduped limit notification
- [x] Bull Board at `/admin/queues`
- [x] Elasticsearch index, search, reindex script, DB fallback

## Phase 4 — Frontend
- [x] Vite + React + TS + Tailwind
- [x] Login, header, scheduled/sent tabs, compose, Slack status, toasts, pagination

## Phase 5 — Docs and demo
- [x] README, `.env.example` (backend + frontend)
- [x] `npm run seed:load` (~1000 emails), `npm run check:logic`
- [x] `npx tsc --noEmit` backend and frontend; self-check passed
- [ ] Live Docker/Postgres/Redis/ES smoke (Docker CLI not on PATH in this environment)

## Next step
Install Docker, then: `docker compose up -d`, copy `backend/.env.example` to `backend/.env`, `npx prisma migrate deploy` in `backend`, provision a sender, run API + worker + frontend. See README demo checklist.
