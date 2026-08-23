# AdLoop SaaS — Production Launch Remediation Plan

## Goal Description
Remediate the critical **P0 launch blockers** and **P1 high-severity reliability issues** identified during the Full Production Readiness Audit of AdLoop SaaS, transforming the system from **CONDITIONALLY READY** to **PRODUCTION READY** for paid merchants.

---

## User Review Required
> [!IMPORTANT]
> **Paymob Webhook Verification (P0-01):**
> Paymob's live webhook payload format and header delivery must be confirmed with live credentials or sandbox transaction before accepting real customer payments.
>
> **Recurring Billing Strategy (P0-02):**
> Paymob relies on Intention / Saved Card Token charges rather than native Stripe-style subscription objects. We propose an automated background cron (`app/api/cron/billing-renewals/route.ts`) running daily at midnight to charge subscriptions expiring within 48 hours.

---

## Proposed Changes

### 1. Payments & Billing Engine (P0)

#### [MODIFY] [`app/api/webhooks/paymob/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/webhooks/paymob/route.ts)
- Support HMAC retrieval from multiple candidate sources:
  1. `req.headers.get("x-paymob-hmac")`
  2. `searchParams.get("hmac")`
  3. `body.hmac` or `body.obj.hmac`
- Make HMAC verification robust against nested key ordering differences while logging unmatched structures safely in development.

#### [NEW] [`app/api/cron/billing-renewals/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/cron/billing-renewals/route.ts)
- Scan all `User` records where `subscriptionStatus == 'ACTIVE'`, `cancelAtPeriodEnd == false`, and `currentPeriodEnd <= now + 48h`.
- Trigger automated charge against `user.savedCardToken` via Paymob Intention API.
- If charge succeeds: advance `currentPeriodEnd` by 1 month / 1 year and log `SubscriptionEvent(type: 'RENEWED')`.
- If charge fails: enter 3-day grace period, mark `subscriptionStatus = 'PAST_DUE'`, send dunning notification email.

---

### 2. Attribution & Data Integrity (P1)

#### [MODIFY] [`app/api/attribution/mark-matched/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/attribution/mark-matched/route.ts)
- Replace local timezone date construction:
  ```diff
  - const receivedDate = new Date(receivedAt);
  - const dayStart = new Date(receivedDate.getFullYear(), receivedDate.getMonth(), receivedDate.getDate());
  + const receivedDate = new Date(receivedAt);
  + const dayStart = new Date(receivedDate.toISOString().slice(0, 10));
  ```
- Ensures exact match with `MetricSnapshot.date` created as UTC midnight by ad platform sync engines.

#### [MODIFY] [`lib/messengerLeadQuality.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/lib/messengerLeadQuality.ts)
- Apply identical UTC midnight normalization for verified Messenger conversions.

---

### 3. Serverless Cron Scalability (P1)

#### [MODIFY] [`app/api/cron/sync-google-ads/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/cron/sync-google-ads/route.ts)
- Implement batching/chunking: process workspaces in batches of 5, or execute platform sync operations with concurrency limits (`p-limit` / `Promise.allSettled`).
- Ensure `CronRunLog` and `captureUsageSnapshots()` are recorded in a `finally` block so timeouts or individual workspace failures never drop metrics.

---

### 4. E-commerce Webhook Consolidation (P1)

#### [MODIFY] [`app/api/webhooks/salla/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/webhooks/salla/route.ts)
- Forward incoming requests internally to the unified `POST /api/webhooks/ecommerce/salla` handler, or return a 308 Permanent Redirect, ensuring all Salla orders flow through customer cohorts, inventory stock guard, and store funnel analytics.

---

### 5. AI FinOps Safeguard (P2)

#### [MODIFY] [`lib/aiRateLimit.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/lib/aiRateLimit.ts) & [`app/api/ai/chat/route.ts`](file:///C:/Users/KING/OneDrive/Desktop/adLoop/adloop-saas/app/api/ai/chat/route.ts)
- Introduce `refundChatQuota(userId: string)` to restore both `aiChatHourlyCount` and `aiCreditsPurchased` if Claude API invocation fails with upstream errors.

---

## Verification Plan

### Automated Tests
1. Run pre-build verification suite:
   ```bash
   node scripts/checkTranslations.mjs
   node scripts/checkWebhookAuth.mjs
   node scripts/checkWorkspaceAccess.mjs
   npx tsx scripts/checkOrderPipeline.mts
   npx tsx scripts/checkCronAuth.mts
   ```
2. Verify full TypeScript compilation:
   ```bash
   npx tsc --noEmit --project tsconfig.json
   ```

### Manual Verification
- Simulate a webhook call with query-string HMAC vs header HMAC.
- Verify `mark-matched` increments `verifiedConversions` across UTC and non-UTC system timezones.
- Validate that the unified e-commerce route records orders and updates inventory stock.
