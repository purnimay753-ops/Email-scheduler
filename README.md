# Postline

Schedule a CSV of emails. The API stores the batch in Postgres and enqueues one BullMQ delayed job per recipient. A separate worker sends through Ethereal, obeying a per-sender gap and an hourly cap. Redis (AOF) keeps the queue across restarts. Postgres is the source of truth.

## Run

```bash
docker compose up -d
npm run install:all
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Put a 16+ character `SESSION_SECRET` in `backend/.env`. Google and Slack can stay blank until you want those buttons.

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
npm run dev          # API on :4000
npm run worker       # second terminal
cd ../frontend && npm run dev   # UI on :5173
```

From the repo root: `npm run dev:api`, `npm run dev:worker`, `npm run dev:web`.

Health: `GET http://localhost:4000/health`.

## Ethereal senders

Ethereal is a fake SMTP inbox ([ethereal.email](https://ethereal.email)). After Google login, click **Add Ethereal sender** on the dashboard, or:

```bash
cd backend && npm run provision-senders -- --count=2
```

Each sender is an Ethereal account (`nodemailer.createTestAccount()`). Sent rows include a preview URL.

## Google OAuth

1. Google Cloud Console → OAuth client (Web).
2. Authorized redirect URI: `http://localhost:4000/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
4. Open `http://localhost:5173/login` → Sign in with Google. The API sets an httpOnly `session` cookie (JWT).

## Slack

1. Create a Slack app. Redirect URL: `http://localhost:4000/api/slack/callback`.
2. Bot scopes: `incoming-webhook`, `chat:write`.
3. Set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_CALLBACK_URL`.
4. Dashboard → Connect Slack.

If Slack is not connected, the limit notification is skipped. The worker reads the integration from Postgres at notify time, so connecting later needs no redeploy.

## Environment

See `backend/.env.example` and `frontend/.env.example`.

| Variable | Role | Default |
|---|---|---|
| `WORKER_CONCURRENCY` | BullMQ worker concurrency | 5 |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Minimum gap between sends on one sender | 2000 |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Hard cap per sender per UTC hour | 200 |
| `JOB_ATTEMPTS` / `JOB_BACKOFF_MS` | SMTP retries, exponential | 3 / 5000 |
| `STALE_PROCESSING_MS` | Crash recovery window for `processing` rows | 300000 |
| `VITE_API_URL` | Leave empty in dev; Vite proxies `/api`, `/auth`, `/admin` | |

Campaign `hourlyLimit` from the UI is a second cap. A send is allowed only when both the sender counter and the campaign counter are under their limits, so the binding cap is the smaller one.

## Architecture

**Schedule.** `scheduledAt = startTime + index * delayBetweenMs`. Recipients are deduped and spread round-robin across the user's senders. Rows are inserted in one transaction, then each email is `queue.add('send-email', {emailId}, { jobId: emailId, delay })`. The job id is the email id, so BullMQ rejects a duplicate enqueue.

**Idempotency.** Unique `(campaignId, toEmail)`. The worker claims with `UPDATE ... WHERE status='scheduled'` and continues only when one row changes. SMTP `messageId` is written before `status='sent'`. A retry that finds `messageId` marks the row sent and does not send again. A crash with no `messageId` is treated as not sent and retried (Ethereal has no idempotency key).

**Restart.** Redis AOF keeps delayed jobs. On API and worker boot, reconciliation runs once (Redis `SET NX` lock, not a timer): `scheduled` / `processing` rows with no live job are re-queued with the remaining delay. `processing` rows younger than `STALE_PROCESSING_MS` that still have an active job are left alone. Rows that already have `messageId` are closed as `sent`.

**Rate limits.** Per sender, a Lua script stores the next allowed send time (`next-send:{senderId}`). If it is in the future the job is `moveToDelayed` and `DelayedError` is thrown so the attempt is not consumed. Hourly counts use `INCR` + `EXPIRE` on `rate:{senderId}:{YYYYMMDDHH}` and `rate:campaign:{campaignId}:{YYYYMMDDHH}`. Over the limit, the job is delayed to the next UTC hour plus `(position - 1) * spacing`. `scheduledAt` is updated. The job is not failed and not dropped. The first hit in a window sets `slack-notified:{reason}:{scope}:{window}` and posts to Slack.

**Load (1000+ at once).** Jobs sit in the delayed/waiting set. Worker concurrency and the per-sender gap drain them slowly. Past the hourly cap, overflow positions roll into later hours and keep order. Nothing is counted in process memory.

**Search.** Creates and status changes index the `emails` document (to, subject, body, status, scheduledAt, sentAt, userId). If Elasticsearch is down, the API logs and keeps serving; search falls back to Postgres. `npm run reindex` rebuilds the index from the database.

**Queue UI.** Bull Board at `http://localhost:4000/admin/queues` (same session cookie as the app).

## Features

| Feature | Backend | Frontend |
|---|---|---|
| Google login | `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/auth/me` | Login page, protected `/` |
| Compose / schedule | `POST /api/campaigns/schedule`, `POST /api/csv/parse` | Compose modal, client-side parse |
| Scheduled / sent lists | `GET /api/emails` | Tabs, skeletons, empty, pagination |
| Search | `GET /api/search` | Search box |
| Senders | `GET/POST /api/senders` | Add Ethereal sender |
| Slack | `/api/slack/connect`, `callback`, `disconnect`, `status` | Connect / status |
| Queue | `/admin/queues` | — |
| Load demo | `npm run seed:load` | — |

## Demo checklist

1. `docker compose up -d`, migrate, start API, worker, and frontend.
2. Sign in with Google. Add an Ethereal sender. Connect Slack (optional).
3. Compose with `examples/recipients.csv`, a start time a minute ahead, delay `2000`, hourly limit `50`. Scheduled tab shows the rows.
4. Wait. Sent tab shows `sent` and Ethereal preview links. Bull Board shows the queue.
5. Stop the worker and API. Start them again. Remaining rows still send once (no second `messageId`).
6. `cd backend && npm run seed:load -- --count=1000 --hourlyLimit=10 --delayMs=0`. Sent count stops at the cap; the rest stay `scheduled` in a later hour. Slack gets one message per sender per window if connected.

## Assumptions

- Vite + React, Prisma, and a JWT in an httpOnly cookie (not a server session store).
- Hour windows are UTC. Min delay default is 2000 ms via `MIN_DELAY_BETWEEN_EMAILS_MS`.
- BullMQ's queue-wide limiter is not used; a global limiter would cap every sender together. Cross-process limits are Redis Lua scripts.
- Bull Board requires the logged-in cookie.
- UI is a clean layout until a Figma file is provided.
- Docker was not available in the environment that typechecked this repo, so migrate/send was not executed there.
- No cron, `setInterval` scheduler, Agenda, or node-cron.
