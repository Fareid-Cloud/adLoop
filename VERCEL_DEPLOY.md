# Vercel deployment

## What changed

- `npm run build` now runs `prisma generate && next build` only.
- The production database schema is no longer modified during a Vercel build.
- Prisma Client is generated after dependency installation through `postinstall`.

## Before the first deploy

1. Create a PostgreSQL database (for example Neon, Supabase, or Vercel Postgres) and put its pooled connection string in `DATABASE_URL`.
2. On your computer, set `DATABASE_URL` to the same database and run `npx prisma db push` once. Do not run it as the Vercel build command.
3. Import this folder into Vercel. Leave Framework Preset as Next.js and Build Command as `npm run build`.
4. Add every required variable from `.env.example` to Vercel's Production environment. In particular `DATABASE_URL`, `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, and the values for any integration you enable.
5. Deploy. Add the production URL to the redirect/callback URLs in Google, Meta, TikTok, Paymob, Salla, and Sentry as applicable.

## Cron note

`vercel.json` defines three scheduled functions. Your Vercel plan must allow three cron jobs. If the dashboard reports a cron quota error, upgrade the plan or remove/merge jobs deliberately; do not delete them blindly because each one performs a different task.

## WhatsApp tracker

`wa-conversion-tracker` is deliberately not included as a production Vercel deployable. It stores state in a local SQLite file (`better-sqlite3`), while Vercel Functions have an ephemeral filesystem. It must be migrated to persistent Postgres/KV before it can safely receive live WhatsApp webhooks; otherwise click-to-conversation matches will disappear between requests.
