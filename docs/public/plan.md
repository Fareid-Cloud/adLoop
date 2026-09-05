# AdLoop SaaS — Production Launch Remediation Plan

> **Status review — 5 September 2026.** This plan was written on 20 August.
> Every item below has been checked against the code as it stands today,
> not carried over. Five of seven are done; the two that are not are named
> with what still blocks them. Where the implementation deliberately
> diverged from the plan, the reason is recorded rather than the plan
> being quietly rewritten to match.

## Goal Description
Remediate the critical **P0 launch blockers** and **P1 high-severity reliability issues** identified during the Full Production Readiness Audit of AdLoop SaaS, transforming the system from **CONDITIONALLY READY** to **PRODUCTION READY** for paid merchants.

---

## Status at a glance

| # | Item | Severity | Status |
|---|---|---|---|
| 1 | Paymob HMAC verification | P0 | ⚠️ **Partly** — the real defect was found and fixed elsewhere; multi-source retrieval was not implemented and is not needed |
| 2 | Recurring billing cron | P0 | ✅ **Done** — built, and gated closed until Paymob MOTO is enabled |
| 3 | `mark-matched` UTC date | P1 | ✅ **Done** — exactly as proposed |
| 4 | Messenger UTC date | P1 | ✅ **Done** |
| 5 | Cron batching / concurrency | P1 | ❌ **Open** — the single largest remaining reliability item |
| 6 | Salla webhook consolidation | P1 | ✅ **Done, differently** — `410 Gone`, not a redirect. Reason below |
| 7 | AI chat quota refund | P2 | ✅ **Done 5 Sep** — and the real defect was larger than this plan described |

---

## User Review Required
> [!IMPORTANT]
> **Paymob Webhook Verification (P0-01):**
> Paymob's live webhook payload format and header delivery must be confirmed with live credentials or sandbox transaction before accepting real customer payments.
>
> **Still true, but narrower than when written.** The field *order* is no
> longer a guess: on 31 August the ninth field was found to read
> `is_auction` where Paymob sends `is_auth`. Vercel's log showed two
> callbacks answered `401` with their intents left `PENDING` — meaning
> **every successful payment was being rejected**. The order now comes from
> Paymob's own documentation. What remains is confirmation on one real
> transaction, not re-derivation.
>
> **Recurring Billing Strategy (P0-02):**
> Paymob relies on Intention / Saved Card Token charges rather than native Stripe-style subscription objects. We propose an automated background cron (`app/api/cron/billing-renewals/route.ts`) running daily at midnight to charge subscriptions expiring within 48 hours.
>
> **Built, and deliberately inert.** `renewViaSavedCard` returns
> `not_configured` without any external call while `PAYMOB_MOTO_INTEGRATION_ID`
> is unset — so today the job behaves exactly as before: remind, then
> `PAST_DUE`. Enabling it is an owner decision that also requires the terms
> text to be reconciled, since the current wording conflicts with automatic
> card charging.

---

## Proposed Changes

### 1. Payments & Billing Engine (P0)

#### ⚠️ [MODIFY] `app/api/webhooks/paymob/route.ts`
**Not implemented as written, and on review it should not be.**

The plan proposed accepting the HMAC from three sources (header, query
string, body). The route reads it from the query string only
(`searchParams.get("hmac")`), which is where Paymob's transaction callback
delivers it.

**Accepting the same secret from three places widens the attack surface for
no gain** — an attacker who can influence any one of them gets a second
door. The verification itself is sound: HMAC-SHA512 over the documented
field order, compared with `timingSafeEqual`, verified live on 5 September
(an unsigned POST returns `401`).

**If** a real transaction later shows Paymob delivering the HMAC in a
header, add that one source explicitly — do not add all three speculatively.

#### ✅ [NEW] `app/api/cron/billing-renewals/route.ts`
Built as specified: scans subscriptions nearing expiry, charges the saved
card, advances the period on success, and enters `PAST_DUE` with dunning on
failure. See the note above on why it stays inert until MOTO is enabled.

---

### 2. Attribution & Data Integrity (P1)

#### ✅ [MODIFY] `app/api/attribution/mark-matched/route.ts`
Implemented exactly as proposed — `new Date(receivedDate.toISOString().slice(0, 10))`
(route line 52). The day key now comes from an explicit UTC slice, so it
matches `MetricSnapshot.date` written as UTC midnight by the sync engines.

#### ✅ [MODIFY] `lib/messengerLeadQuality.ts`
Same normalisation applied (line 147).

---

### 3. Serverless Cron Scalability (P1) — ❌ **OPEN**

#### [MODIFY] `app/api/cron/sync-google-ads/route.ts`
**Not done.** No batching, no concurrency limit, no `Promise.allSettled`,
no `finally` around the run log.

This is the **largest remaining reliability item**, and a later audit
reached the same conclusion independently (`AUDIT-FINDINGS.md`, BI-3 and
BI-4): the whole daily sync runs sequentially inside one 300-second
invocation, with N+1 Prisma writes *and* N+1 external API calls nested
inside the loops across all three sync files. One workspace with 20
campaigns × 10 ad groups is roughly 200 sequential Graph calls plus 200
upserts plus up to 1,400 daily upserts — all awaited one after another.

**Why it has not been fixed yet:** it is the one item here that is real
architectural work rather than a contained patch, and it has not yet
caused a visible failure — the customer count is still low enough that the
300-second ceiling is not being hit. It will be hit before it is noticed.

---

### 4. E-commerce Webhook Consolidation (P1) — ✅ **Done, differently**

#### [MODIFY] `app/api/webhooks/salla/route.ts`
The plan proposed forwarding internally or returning a `308 Permanent
Redirect`. **The route returns `410 Gone` instead, and the difference
matters.**

A redirect keeps the old address functional. That preserves the exact
defect the consolidation existed to remove: a merchant registered at both
URLs has every order counted twice, because the two paths deduplicate under
different scopes and different event ids, so the unique constraint never
collides. A merchant registered at the old one alone got no `Order`,
`Customer` or `ProductSaleEvent` rows at all.

`410` tells the store the endpoint is gone and to stop retrying — where a
`404` would read as a temporary error and be retried for days. The old URL
can no longer swallow an order silently. The single supported address is
`/api/webhooks/ecommerce/salla`.

---

### 5. AI FinOps Safeguard (P2) — ✅ **Done 5 September**

#### [MODIFY] `lib/aiRateLimit.ts` & `app/api/ai/chat/route.ts`
Implemented as `refundChatQuota`, **and the defect was larger than this
plan described.** A refund did exist inline in the chat route, but it was
wrong in three ways:

1. **The hourly counter was never refunded.** Consumption debits both
   monthly and hourly; the inline refund restored only the monthly one, so
   a failed call still burned the caller's hourly slot and blocked a retry
   for a failure that was not theirs.
2. **A raw `update` with no `gt: 0` guard** — the comment above the
   existing `refundAiRefreshQuota` warns about this exact shape: two
   parallel refunds read the same value and decrement once, or drive the
   counter below zero into free credit.
3. **No owner check.** The owner is never charged, so refunding gave the
   owner a negative counter.

The monthly field is `aiRefreshMonthlyCount` by design, not by mistake —
the monthly pool is shared between refresh and chat, and that is what
consumption debits.

---

## Verification Plan

### Automated Tests
1. Run the pre-build verification suite. **The chain is now 23 steps, not 5** —
   `package.json` is the live reference. The security-relevant gates:
   ```bash
   node scripts/checkWebhookAuth.mjs
   node scripts/checkWorkspaceAccess.mjs
   node scripts/checkEmailSend.mjs
   node scripts/checkAuthRateLimit.mjs      # added 5 Sep
   node scripts/checkReadinessCoverage.mjs  # added 5 Sep
   node scripts/checkWaClickParity.mjs      # added 5 Sep
   npx tsx scripts/checkCronAuth.mts
   npx tsx scripts/checkOrderPipeline.mts
   ```
2. Verify full TypeScript compilation:
   ```bash
   npx tsc --noEmit --project tsconfig.json
   ```

### Manual Verification
- ~~Simulate a webhook call with query-string HMAC vs header HMAC.~~
  Superseded: query-string is the only accepted source, by decision. What
  remains is confirming one **real** Paymob transaction end to end.
- ~~Verify `mark-matched` increments across UTC and non-UTC timezones.~~
  Done — the day key no longer reads the host timezone at all.
- Validate that the unified e-commerce route records orders and updates
  inventory stock. **Still outstanding** — needs a real connected store.

---

## What this plan does not cover

Written for the 19 August audit, it predates work that a reader looking for
"what is left" will otherwise miss:

- **The 5 September security review** (`docs/security-review-2026-09-05-*.md`)
  — a written threat model, three Mediums found and fixed, and a live
  non-destructive pentest against production. Score 95/100.
- **Activation** (`docs/activation-checklist.md`) — the real blockers are
  now an owned domain and a Vercel Pro plan, neither of which is code.
