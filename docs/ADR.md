# AdLoop — Architecture Decision Record (ADR)

**Status:** Living document. Last comprehensive accuracy pass: post-launch-readiness review (47
pages, 71 API endpoints, 48 database models shipped; product has moved well past the original
"Phase 1 foundation" this document was first written for — most "Phase 1" items referenced below
are completed, and are marked ✅ or updated in place where found stale during review).
**Owner:** Product/Engineering (single-owner project — see §12 for what that means for process).
**Purpose:** This is the single source of truth for why AdLoop is built the way it is. Every future
architectural decision should either follow this document or explicitly amend it. If code and this
document disagree, one of them is wrong — fix the mismatch, don't let it linger.

---

## 1. Product Philosophy

AdLoop exists to answer one question a media buyer cannot currently answer honestly: **"What is
actually happening, not what the platform says is happening?"** Every ad platform (Google, Meta,
TikTok, Snapchat) has a structural incentive to report generously. AdLoop's entire reason to exist is
to sit between the platform's claim and verified reality (a WhatsApp message that was actually sent,
an order that was actually placed, a price that actually covers cost) and surface the gap.

Every future decision should optimize for, in this order:

1. **Truthfulness of data** — a wrong number destroys the product's only reason to exist. Bugs that
   corrupt a metric are more severe than bugs that crash a page.
2. **Clarity of the next action** — a screen that shows data without implying a decision has failed.
3. **Longevity of the codebase** — this is a single-founder product today; every screen and every
   API must be maintainable by one non-technical founder directing an AI engineer, which means
   consistency and self-documentation matter more than cleverness.
4. **Speed to first paying customer** — real usage will surface more real problems than any amount
   of anticipatory design. Do not gold-plate infrastructure no one is using yet.

**Non-negotiable:** AdLoop should never display a number it cannot explain the provenance of. If a
metric's calculation can't be traced back to a specific source (platform API, verified webhook,
manual upload), it should not ship.

---

## 2. Architecture Principles

Rules that should never be broken without a documented exception in this file:

- **One database, one ORM, one schema file.** `prisma/schema.prisma` is the single source of truth
  for data shape. No parallel ad-hoc tables, no shadow state kept only in application memory for
  anything that must survive a request.
- **Server Components by default, Client Components only when interactivity requires it.** This is
  a Next.js App Router project; the temptation to make everything a client component (as was common
  in the Pages Router era) is explicitly rejected. A page that only reads and displays data has no
  business shipping JavaScript to the browser for that purpose.
- **Business logic lives in `lib/`, never inline in a route handler or a page component.** Route
  handlers and pages are thin — they authenticate, call a `lib/` function, and shape the response.
  This is already the pattern (`metricsEngine.ts`, `ecommerceMetrics.ts`, `automationRules.ts`,
  `healthScore.ts`, etc.) — Phase 1 makes it a hard rule rather than an emergent habit.
- **Every webhook is idempotent and signature-verified before it touches the database.** This is not
  optional per-integration; it's a platform capability (`lib/webhookSecurity.ts`) that every new
  integration (Shopify, Easy Orders, future ones) must use, not reimplement.
- **Every destructive relationship in the schema has an explicit `onDelete` policy.** No relation
  ships without one (see §5, §10).
- **No feature ships without an i18n path.** Every user-facing string goes through
  `lib/i18n/dictionary.ts`. A hardcoded Arabic or English string in a component is a bug, not a
  style choice (this was a real recurring bug class earlier in the project — see §14).
- **A metric's calculation logic exists in exactly one place.** `weightedAverage()` in
  `ecommerceMetrics.ts` and the identical pattern in `landingPageAudit.ts` and `healthScore.ts` are
  the same idea implemented three times. Phase 1 unifies this into one shared utility
  (`lib/scoring.ts`) — see §14, this is a documented near-term refactor, not a rewrite.

---

## 3. Design Principles

Per the design brief this ADR is responding to: **dense but readable, confident, fast, purposeful,
timeless.** Concretely:

- **Density over whitespace.** Information hierarchy comes from typography weight, size, and color
  contrast — not from empty space. A screen with 40% whitespace "for breathing room" is a marketing
  landing page pattern, not an application-of-record pattern. This corrects an earlier direction in
  this project (an over-rotation toward Mercury-style generous spacing) — the design brief is right
  and takes precedence.
- **Every screen answers a question, not displays a category of data.** Before building any screen,
  the question it answers must be written down in one sentence. If that sentence can't be written,
  the screen doesn't ship yet.
- **Consistency beats novelty.** A table looks the same whether it's showing campaigns, experiments,
  or diagnostics. A user who learns one part of AdLoop already knows 80% of every other part.
- **No decorative motion.** Animation exists only to communicate state change (a number counting up
  to its real value, a row entering after a filter, a skeleton resolving into content) — never as
  ambient decoration.
- **Color is semantic, never decorative.** This principle already exists in `theme.css`
  (`--verified`, `--gap`, `--critical` are fixed regardless of accent theme) — Phase 1 extends it:
  no new color may be introduced without a defined meaning attached to it.

---

## 4. Component Philosophy

**Rule of three:** the first time a UI pattern is needed, write it inline. The second time, note
that it's a duplicate. The third time, extract it into `app/components/` before continuing. This
project has already broken this rule once (three separate ad-hoc "placeholder page" stubs written by
hand instead of one `<UnderConstruction />` component) — Phase 1 fixes this.

**What must be a shared component from day one** (because the design brief explicitly requires
world-class, consistent behavior for these, and retrofitting consistency later is expensive):

- `DataTable` — one component for every table in the product (sorting, filtering, pagination, empty
  state built in). Bulk actions and column customization are deferred (see §9, §14) but the
  component's API should not need a breaking change to add them later.
- `MetricCard` — replaces the current copy-pasted inline `<div>` blocks in `page.tsx`.
- `GapMeter` — already exists and is correctly isolated; Phase 1 upgrades its visual treatment
  without changing its API.
- `EmptyState`, `Skeleton`, `ErrorBoundaryFallback` — one implementation each, reused everywhere.
- `PageHeader` — every page's title/breadcrumb/action-button row, currently hand-rolled per page.

**What should never be duplicated:** any calculation. If a number appears on two screens, it is
computed once (in `lib/`) and rendered twice, never computed twice.

---

## 5. Data Philosophy

- **Single source of truth: Postgres, accessed only through Prisma.** No component or route reaches
  into a raw SQL client, a second database, or a cached copy that can drift from the source of
  truth.
- **Derived data is computed at read time from raw data, not stored redundantly**, with one
  documented exception: `MetricSnapshot` is itself a daily aggregate (a deliberate pre-computation
  for query performance, not raw event data) — this is acceptable because the aggregation window
  (one platform/campaign/day) is fixed and the raw source (platform APIs, webhooks) remains
  re-fetchable if the aggregate is ever wrong.
- **Every workspace-scoped table cascades from `Workspace`.** This was retroactively fixed in the
  hardening pass (`onDelete: Cascade` added to all 13 relations) — Phase 1 makes it a schema review
  checklist item for every new model, not a thing to remember.
- **Idempotency keys for anything that can be delivered more than once.** `ProcessedWebhookEvent` is
  the general-purpose pattern; any new inbound integration reuses it rather than inventing a
  bespoke "have I seen this before" check.

---

## 6. State Management Philosophy

- **Server state lives on the server. Full stop.** The dashboard's `page.tsx` files are Server
  Components that query Prisma directly — there is no client-side data-fetching library
  (React Query, SWR) in this project, and Phase 1 does not introduce one. This is a deliberate
  rejection, not an oversight: Next.js App Router's server-component model plus `router.refresh()`
  for mutation-triggered revalidation (already the pattern in `CreateWorkspaceForm.tsx`) covers the
  vast majority of this product's needs without adding a client cache layer to reason about. If a
  genuinely global, frequently-mutated, cross-component client state need emerges (it has not yet),
  revisit this — don't pre-adopt a state library speculatively.
- **Local UI state (form inputs, toggle state, modal open/closed) stays local** via `useState` in
  the smallest component that needs it. No global store for things that are inherently local.
- **Derived state is computed, never duplicated into state.** If a value can be calculated from
  props or server data during render, it is not stored in `useState`.
- **URL is the source of truth for shareable view state** (filters, sort order, selected date
  range) once tables are built in Phase 1 — not component state. This makes every filtered view
  linkable and makes browser back/forward behave correctly, which matters once `DataTable` ships.

---

## 7. API Philosophy

- **Route handlers under `app/api/` are for: webhooks, cron triggers, and mutations invoked from
  Client Components.** Server Components fetch data directly via Prisma — they do not call the
  app's own API over HTTP (that would be a needless network hop to itself).
- **Response shape:** `{ data: T }` on success, `{ error: string }` on failure, matching the
  pattern already used across existing routes. Phase 1 formalizes this as a shared
  `lib/apiResponse.ts` helper so every route returns the same shape instead of ad-hoc objects.
- **HTTP status codes are meaningful and consistent:** 401 unauthenticated, 403 authenticated-but-
  forbidden (signature failures), 400 bad input, 404 not found, 429 rate-limited, 500 unexpected.
  This is already followed informally; Phase 1 makes it explicit.
- **Naming:** REST-ish, resource-oriented (`/api/workspaces`, `/api/action-feed/[id]/apply`), verbs
  only for actions that aren't CRUD (`/apply`, `/dismiss`, `/refresh-insights`).
- **No API versioning yet.** With one consumer (the app itself) and no external API contract to
  break, versioning today is pure overhead. Revisit if/when AdLoop exposes a public or partner API.
- **Every mutation route re-validates ownership** (`workspaceId` belongs to the authenticated
  `user.id`) inside the handler — never trust a client-supplied workspace ID without checking it
  against the session. Verified during a comprehensive review pass: `refresh-insights` (previously
  flagged as a gap here) now includes the check; this remains a standing rule for every new route.

---

## 8. Performance Philosophy

- **Aggregate at write time for anything queried repeatedly.** `MetricSnapshot` already does this;
  new high-cardinality data (e.g. per-click events) should roll up into daily aggregates rather than
  forcing every page load to scan raw event tables.
- **Every list query is paginated or date-bounded by default**, never `findMany` with no `take` or
  `where` on an unbounded table. The Overview page's 30-day window is the pattern to replicate.
- **Every foreign key used in a `WHERE` clause has a matching index.** This was a real bug found in
  hardening (the Salla webhook's lookup pattern had no supporting index) — Phase 1 adds a review
  step: any new query pattern gets its index added in the same PR, not discovered later under load.
- **Heavy or slow work never blocks a user-facing request.** AI calls, screenshot capture, and
  multi-workspace syncs run via cron or background jobs (§9), never synchronously inside a page
  load or a webhook handler that must respond quickly.
- **Images and fonts load through Next.js's built-in optimization** (`next/font/google`, and
  `next/image` once real imagery is introduced) rather than raw `<img>` tags or manually linked
  fonts — this was itself a bug fixed in this project (a font declared in CSS but never actually
  loaded) and is now a hard rule, not a preference.

---

## 9. Scalability Philosophy

The product must not need re-architecture at "many workspaces, thousands of campaigns" scale — but
today's team (one founder, no ops function) also cannot operate infrastructure sized for that scale
prematurely. The resolution:

- **Design the schema and query patterns for scale now** (indexes, pagination, aggregation) because
  retrofitting those into live data later is expensive and risky.
- **Do not provision infrastructure for scale now** (no queue system, no read replicas, no caching
  layer beyond what Postgres and Next.js give for free) because that infrastructure has ongoing cost
  and operational burden with zero current users to justify it.
- **Background jobs today = Vercel Cron + sequential processing** (see `sync-google-ads` cron: loop
  over workspaces one at a time, catch and log per-workspace failures so one broken workspace
  doesn't block the rest). This is explicitly the ceiling of the current approach — the point at
  which it must change is documented in §14 (roughly: when a single cron run risks exceeding the
  platform's function duration limit, which is a knowable, monitorable threshold, not a guess).
- **Multi-tenancy is row-level (`workspaceId` on every table), not schema-per-tenant or
  database-per-tenant.** This is correct at any realistic scale for this product and should not be
  revisited without a specific, measured reason.

---

## 10. Security Philosophy

- **Every webhook verifies a cryptographic signature before touching the database** (§2, §5) —
  applies to Salla, WhatsApp/Meta, and every future inbound integration without exception.
- **Secrets are validated at boot, not discovered at first use.** `instrumentation.ts` /
  `envCheck.ts` fails fast with a clear message if required environment variables are missing,
  rather than surfacing a confusing runtime error to the first real user who hits the code path.
- **Passwords are hashed with bcrypt (cost factor 12), sessions are JWT in an httpOnly cookie.**
  This is adequate for the current single-user-per-account model. NextAuth.js migration is deferred
  (§14) until OAuth provider integrations (Google/Meta account linking) make a unified session
  system worth the migration cost.
- **No secret, token, or credential is ever logged**, including in error messages sent to Sentry —
  this is a review checklist item for every new integration, since it's the kind of mistake that's
  easy to make in a `console.error(err)` that accidentally includes a request object.
- **Least privilege by default:** a user can only ever act on workspaces they own (§7). There is no
  admin backdoor route, no "debug mode" that bypasses ownership checks, in production code.
- **Input validation happens at the API boundary**, not assumed from the client. Every route handler
  validates shape and type of its input before passing it to `lib/` logic — currently inconsistent
  (some routes validate, some trust); Phase 1 standardizes this with a shared validation pattern
  (lightweight, likely `zod`, introduced when the API surface is formalized — not a new dependency
  added speculatively before it's needed).

---

## 11. UI System Philosophy

- **Typography:** a fixed type scale (to be defined numerically in Phase 1 tokens — not the current
  ad-hoc `fontSize: 13/14/18/20/24/26/28` scattered across files). Almarai for Arabic display text,
  IBM Plex Mono for all numeric data (prices, metrics, dates) — numbers are always monospaced so
  columns of figures align visually, a detail every reference product in the brief gets right.
- **Spacing:** a defined scale (4px base unit: 4/8/12/16/24/32/48), not arbitrary pixel values.
- **Grid:** consistent page-level container widths and column gaps, defined once, used everywhere —
  not re-decided per page as it is today.
- **Tables:** one `DataTable` component (§4).
- **Forms:** consistent input, select, and validation-error styling — currently duplicated between
  `login/page.tsx`, `signup/page.tsx`, and `CreateWorkspaceForm.tsx` with slightly different inline
  styles for the same visual element. Phase 1 unifies into shared form primitives.
- **Dialogs / side panels:** not yet built anywhere in the product — Phase 1 defines the pattern
  before the first modal is needed (row detail views in `DataTable`, confirmation dialogs for
  destructive actions like Workspace deletion) rather than inventing it ad hoc under deadline
  pressure.
- **Navigation:** left sidebar, icon + label, active-state highlighting — already established;
  Phase 1 formalizes it as a data-driven config (already the case — `NAV_ITEMS` array) so adding a
  module is a one-line addition, matching the brief's "scale naturally" requirement.
- **Charts:** Recharts (already an approved dependency), used only where a chart answers a specific
  question (§3) — never as decoration. Every chart ships with a one-line caption stating what
  decision it should inform.
- **Cards / Loading / Errors / Empty states:** one implementation each (§4), used everywhere,
  designed once in Phase 1's reference page and then propagated, not redesigned per screen.

---

## 12. Code Organization

- **Folder structure** (current, retained): `app/` for routes and pages (App Router), `lib/` for
  all business logic and framework-agnostic utilities, `app/components/` for shared UI, `prisma/`
  for schema. Phase 1 adds `app/components/ui/` specifically for the new primitive component set
  (§4, §11) to separate "generic reusable UI" from "business-specific composed components" that may
  live directly in a feature's folder.
- **Naming conventions:** camelCase for functions and variables, PascalCase for components and
  types, kebab-case for route folders (already consistent). Database fields are camelCase in
  Prisma/TypeScript, mapped automatically to the DB's native casing — no manual translation layer.
- **Module boundaries:** a `lib/` file should have one clear responsibility matching its name
  (`ecommerceMetrics.ts` computes e-commerce metrics; it does not also send emails). This is
  already mostly true and Phase 1 keeps it as a review standard, not a new pattern.
- **When to refactor:** the "rule of three" (§4) governs components; for `lib/` logic, refactor when
  the same calculation pattern appears in a second file (the `weightedAverage` duplication noted in
  §2 and §14 is the trigger example, not a hypothetical).
- **Given the single-operator reality of this project** (a non-technical founder directing an AI
  engineer across sessions), this document itself is part of the codebase's "process" — it replaces
  the role that a team's shared tribal knowledge and code review culture would normally play. It
  must be kept accurate, or it becomes actively misleading, which is worse than not having it.

---

## 13. Technical Decisions

| Decision | Chosen | Alternatives considered | Why rejected |
|---|---|---|---|
| Framework | Next.js (App Router) | Remix, plain Express + React SPA | App Router's Server Components eliminate an entire class of client-state/data-fetching complexity (§6) that would otherwise need a library; matches the founder's existing stack across other projects (Tamkeen, Thawabet, iDigital), reducing context-switching cost. |
| Database | PostgreSQL via Prisma, hosted on Supabase/Neon free tier | SQLite, MongoDB | SQLite doesn't handle concurrent writes well on serverless (documented in project README from day one); Postgres relational integrity (foreign keys, cascades) is core to §5's data-integrity guarantees, which a document store would make harder to enforce. |
| Auth | Hand-rolled JWT + bcrypt, **plus direct Google/Facebook social login** (name+avatar pulled directly) | NextAuth.js / Auth.js | Simpler for the current model. **Update:** OAuth account-linking for ad platforms (Google/Meta/TikTok) is now extensively built, meeting the original trigger for revisiting NextAuth — the migration is a conscious ongoing deferral, not a blocker, since the hand-rolled system works and migrating has real risk/cost with no acute pain point forcing it yet. |
| Styling | **Tailwind CSS (adopted, executed)** — CSS custom properties in `theme.css` (`--bg`, `--surface`, `--accent`, `--verified`, `--gap`, `--critical`, etc.) as the design-token layer underneath Tailwind utility classes | Inline `style={{}}` objects (the original early state), CSS Modules, styled-components | Tailwind chosen for exactly the reasons the original "Challenge" note below predicted - utility-class consistency, purged bundle size, tooling-enforced spacing/typography scale. Migration is complete; every current screen uses `className` with the theme tokens, not inline style objects. |
| Charts | Recharts | Chart.js, D3 directly, Plotly | Already an approved/available dependency; React-native API fits the Server/Client Component split better than imperative libraries (D3) which fight React's render model. |
| Icons | Lucide React | Heroicons, Phosphor, custom SVGs | Consistent single-stroke-weight system (matches "timeless, professional" brief in §3); already integrated. |
| AI provider | Claude (Anthropic API) | OpenAI, open-source models | Direct product fit (this is a Claude-built and Claude-operated product); Anthropic SDK's vision support is used directly for the Site Scan module. |
| Error monitoring | Sentry (free Developer tier) | Self-hosted alternatives, no monitoring | Zero cost at current scale (§ hardening pass), industry-standard, low integration effort via `@sentry/nextjs`. |
| Background jobs | Vercel Cron (sequential loop) | Queue system (BullMQ/SQS), external scheduler | Zero additional infrastructure cost or operational surface at current scale; explicitly documented as a decision to revisit (§9, §14), not a permanent architecture. |

**Resolved — Styling approach (originally flagged as a Phase 1 challenge, now executed):** the
product migrated fully to Tailwind CSS, configured with the CSS custom properties (`--bg`,
`--surface`, `--accent`, etc.) as the design-token layer, exactly as originally recommended. Semantic
color meaning (§3) is preserved (`--verified`/`--gap`/`--critical` stay fixed regardless of the
user's chosen accent theme), and the spacing/typography scale is enforced at the tooling level.
This section is kept for historical record of the reasoning; there is no remaining migration work.

---

## 14. Future Evolution

Decisions intentionally postponed, and the trigger condition for revisiting each:

- ✅ **Tailwind migration** — completed. Every current screen uses Tailwind utility classes against
  the `theme.css` design tokens, not inline style objects. (Exception, tracked separately: a handful
  of pre-Tailwind-era auth pages — login/signup/password reset — still use inline styles as a
  deliberate, acknowledged placeholder pending a dedicated auth-UI design pass.)
- **Shared `lib/scoring.ts` for weighted-average calculations** — currently duplicated across
  `ecommerceMetrics.ts`, `landingPageAudit.ts`, `healthScore.ts`. Trigger: next time any of the
  three is touched for an unrelated change — fix opportunistically rather than as a standalone
  refactor PR that risks the "big scary rewrite" trap.
- **`zod` (or similar) input validation** — introduce when the API surface stabilizes enough that
  writing a schema per route is worth more than it costs. Trigger: the first time a malformed
  request causes a production bug that validation would have caught.
- **NextAuth.js migration** — deferred until Google/Meta OAuth account-linking is built (the actual
  moment this project needs multi-provider session handling). Building it earlier means solving a
  problem (unifying providers) that doesn't exist yet.
- **DataTable bulk actions / column customization** — deferred per §2's challenge in the design
  brief response; build the base table now, add these when a real user's workflow demonstrably
  needs them (a founder with 3 campaigns does not need bulk-select).
- **Background job architecture beyond sequential cron** — revisit when either (a) a single cron
  run's total duration approaches the platform's function timeout, or (b) a job needs to be
  triggered by an event rather than a schedule (e.g., "re-run diagnostics immediately after a
  campaign link is added" rather than waiting for the next cron tick). Until then, a queue is
  solving a problem AdLoop doesn't have.
- **Read replicas / caching layer (Redis, etc.)** — revisit only if query latency becomes a
  measured, user-reported problem. Not before.
- **Public/partner API + versioning** — revisit if/when a third party (not AdLoop's own frontend)
  needs to consume this data.
- **SQLite → fully retired (partially achieved)** — `wa-conversion-tracker` still runs its own
  SQLite database independently, but the trigger condition ("data needs to be queried jointly with
  AdLoop's") is now met in practice: every real verification event (WhatsApp code match, Messenger
  conversation confirmed genuine) calls back to AdLoop's own Postgres via `/api/attribution/*` and
  increments `MetricSnapshot.verifiedConversions` directly — the two databases are integrated at the
  event level, not merged at the storage level. Full SQLite retirement (moving click-tracking storage
  itself into Postgres) remains open; revisit if SQLite's serverless concurrent-write limitations
  (the original reason it was flagged, per README history) become an actual observed problem.
- **Recurring product decisions log:** MCP Server, in-app contextual Help, AI Forecast, Attribution
  Explorer, Competitor Monitor, and the payment/subscription system remain tracked as product
  backlog (outside this ADR's scope, which is architecture, not feature roadmap) — see `README.md`
  for that list.
- **Deep visual design polish — the dedicated pass happened.** After full functional coverage was
  reached, a focused design session evaluated 5 distinct visual directions and selected "الشاهد" (The
  Witness): the product's core differentiator (verified vs. reported data) became the literal visual
  grammar via `TrustNumber`/`MetricCard` trust-signal treatment, applied to the highest-leverage
  shared components first (not yet every single page — extension is incremental, tracked in
  `CLAUDE.md`). Real brand colors per ad platform, colorful semantic KPI cards, and interactive
  data-tied gauges (`TrackingAccuracyGauge`) were added in the same pass. The auth pages
  (login/signup/password reset) remain the one deliberately-deferred exception noted above.
- **Rejected: custom failover/multi-region infrastructure before launch.** User asked
  specifically about an automatic backup system to keep the product running during
  server downtime. Explicitly declined to build this now — Vercel's own infrastructure
  already provides distributed, auto-scaling hosting with strong uptime guarantees;
  building custom failover on top of that would duplicate what the platform already
  does better, for a problem that doesn't exist yet (zero paying customers). Recommended
  a free external uptime monitor (UptimeRobot) for detection instead of a custom system.
  Revisit only if real usage/scale later demonstrates Vercel's own resilience is
  insufficient — same "real usage over anticipatory design" principle as elsewhere in
  this document.
- **Rejected: numeric feature-count targets** (e.g. "500 settings", "70 report columns", "40 charts")
  as a design brief. Explicitly decided against building toward arbitrary quantity targets — Notion
  and Optmyzr, the reference products cited for "enterprise maturity," are not enterprise-feeling
  *because* they expose hundreds of options; they're powerful because of smart defaults, progressive
  disclosure, and depth where it matters (Rule Engine, block system) rather than breadth everywhere.
  A settings page with hundreds of toggles is a maintenance and UX liability, not a strength.
  Real feature requests are still built (search across settings, saved table views, period-over-
  period comparison, historical data backfill) — they're just evaluated on genuine user value, not
  a target count.

---

*This document must be updated in the same session/PR as any decision that contradicts it. An
out-of-date ADR is worse than no ADR — if you find a mismatch between this file and the code, treat
that as a bug and resolve it (either fix the code or amend this document with the reasoning for the
change).*
