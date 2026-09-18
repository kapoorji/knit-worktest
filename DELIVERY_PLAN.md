# DELIVERY_PLAN — full product to MVP in 6 weeks (v2)

**Goal:** ship a knitters' mobile app to the App Store and Google Play in 6 weeks
**and know whether the core bet worked** (see *MVP success* below — shipping is
necessary, not sufficient).
**Team:** 1 frontend (React Native) + 1 backend (Python). **My role:** technical
lead — architecture, scope calls, review, unblock, and own the store submissions.

> **v2 — revised after a dual review** (senior product + senior engineering).
> Main changes: a success metric and a launch learning-loop; release + infra
> front-loaded to Week 1; Week 3 split so the swatch service isn't overloaded;
> cost/safety guards moved to ship *with* generation; and a layered biggest-risk
> framing.

The full vision is six surfaces: learning guides, AI assistant, project planner
with swatch preview, yarn/needle inventory, community feed, and accounts. Six
weeks with two engineers cannot ship all six *well*, so the plan is built around a
hard MVP scope and an explicit cut list.

## MVP scope (what actually ships in 6 weeks)

| Ships | Cut / deferred (v1.1+) |
|---|---|
| Accounts (email + Apple/Google sign-in) | Community feed → **read-only "gallery" only**, no posting/comments |
| AI assistant (the two PoC calculators + assistant, hardened) | Rich learning-guide authoring/CMS → **static bundled content** |
| Project planner **with swatch preview** (the differentiator) | Inventory → **basic list add/edit only**, no barcode/stash analytics |
| Learning guides (read-only, curated content) | Multi-colour (Fair Isle) swatches; social graph; notifications |
| Inventory (minimal: add yarn/needle, list) | Web app; iPad-optimised layouts; deep ASO |

**Rationale:** the assistant (trust) and the planner+swatch (the visual hook) are
the product's reason to exist and its two hardest technical bets, so they get the
build effort. Guides are content, not engineering. Community and inventory ship as
thin slices that prove the shape without the depth.

## MVP success — how we know it worked

Shipping is the deadline, not the goal. We instrument from Week 2 and judge the
launch on:

- **Assistant trust:** answer-acceptance rate, an appropriate **decline** rate
  (declining the right questions), and the **"this looks wrong"** report rate on
  numbers (our fastest trust signal, and repair channel).
- **Swatch value:** preview → **project-start** conversion, and colour
  regenerate/reject taps.
- **Activation (north star for MVP):** share of new users who complete a first
  planned project (planner → preview → save) in their first session.
- **Trust guardrail:** number/swatch dispute rate stays under an agreed threshold;
  store rating and community sentiment monitored.

**Business-model signal (not built for MVP):** the product's natural revenue is
materials commerce / affiliate — users buy yarn on the app's numbers. MVP
*instruments intent* (a "where to buy" tap) without building checkout.

## Architecture (thin, boring, shippable)

- **Frontend:** React Native (Expo + EAS). OTA is **JS bugfixes only** — native or
  behavioural changes go through store review; runtime version pinned.
- **Backend:** Python (FastAPI), Postgres with **Alembic migrations** (migration
  per PR), object storage + CDN for swatch images, a job/queue worker for warming.
- **Contract-first:** FastAPI **OpenAPI** published Week 1; FE types generated from
  it and a **mock server** stood up, so FE/BE build in parallel without drift.
- **AI:** LLM behind our own endpoint (assistant *understands/phrases*; numbers
  come from the calculator service — the PoC pattern). Image model behind a swatch
  service with the cache + tint + warm pipeline from the PoC.
- **Cross-cutting from Week 1:** secrets manager (keys never in repo/Expo bundle),
  Sentry + structured logging, managed-Postgres automated backups/PITR, CI running
  lint + tests + an EAS preview build on every PR, auth tokens in **SecureStore**
  (not AsyncStorage), and **Sign in with Apple** offered wherever third-party
  sign-in is (App Store 4.8).
- **Key principle carried from the PoC:** deterministic calculators are the source
  of truth; every generated image is cached and colour is applied in code. This is
  what lets a two-person team ship something *trustworthy* fast.

## Weekly plan

| Wk | Frontend (RN) | Backend (Python) | Milestone / demo |
|---|---|---|---|
| **1 — Foundations & release readiness** | App shell, navigation, design system (accessibility baked in), auth screens (SecureStore); **EAS dev/preview/prod profiles**; **first real TestFlight + Play Internal binary** | Auth + user model (JWT/refresh, Sign in with Apple); Postgres + **Alembic**; **secrets manager**; **Sentry + logging**; **backups/PITR**; **CI**; **publish OpenAPI + mock server**; port calculator service | Empty app installs from both store test tracks; auth works; **contract + mock live**; every later week is debuggable |
| **2 — Assistant + instrumentation** | Assistant chat UI; planner input form; **product analytics events**; **"this looks wrong" report** control; build on the mock | Assistant endpoint (LLM + verified numbers + decline); **calculator unit tests as a CI gate**; analytics ingestion; **draft privacy-nutrition / data-safety** forms (data flows now known) | **Assistant answers for real**; disputes/declines are measured |
| **3 — Swatch service (core) + guards** | Swatch preview screen (hero image, colour chips, zoom); placeholder → swap | **Swatch service: prompt→generate→cache→tint→fallback** (no warming yet); object storage + CDN write/invalidate; **spend caps + rate limit + generation kill-switch shipped with it** | **Swatch preview live**; tap-a-colour instant from cache/tint; **spend is capped** |
| **4 — Warming, content, inventory** | Learning guides reader (bundled); inventory list add/edit; per-screen empty/error states | **Preset warming worker** (queue); content delivery; inventory CRUD (delete-cascade aware) | End-to-end planner → preview; guides + inventory usable; presets pre-warmed |
| **5 — Trust, safety, first-run** | Read-only community gallery; **onboarding / first-run + AI disclosure**; polish | **Moderation / safety gate** on generated + shared images; **in-app account deletion + data export** (delete-cascade); observability dashboards; cost alerts | Feature-complete MVP; internal dogfood; **trust controls live** |
| **6 — Harden & submit** | Final accessibility pass; store assets (screenshots, copy, ASO basics); bug bash | Load/cost test; **backup-restore drill**; finalise privacy/data-safety forms | **Submit to App Store + Google Play**; buffer for reviewer Q&A |

**Release engineering is Week-1 work, not Week-6 hope.** Apple/Google enrollment
(DUNS can take days), EAS production profile, signing, and a real store-track
binary are proven in Week 1; the disclosures are drafted Week 2 when data flows are
known — so Week 6 is genuinely "press submit and answer questions."

## Critical-path dependencies

1. **Auth + contract + infra (wk1) → everything.** User-scoped features wait on
   auth; FE/BE parallelism waits on the published OpenAPI + mock; every later week
   waits on CI, migrations, secrets, and logging existing.
2. **Store enrollment + EAS prod build (wk1) → wk6 submission.** The one path with
   external, uncompressible latency — de-risked with a real Week-1 binary.
3. **Swatch service core (wk3) → swatch UI + warming (wk4).** FE stays on the mock
   until the real service is green; warming is deliberately *after* the core so
   Week 3 isn't overloaded.
4. **Spend caps + kill-switch (wk3) ship with generation** — never a window where
   images generate before guards exist.
5. **Founder constant-validation sign-off (by wk2)** → the assistant can go to
   dogfood. A wrong constant is worse than a late launch (see risks).

## Top risks & mitigations

| Risk | Mitigation |
|---|---|
| **A confidently, deterministically *wrong* number or swatch** reaching a knitter who buys real yarn on it (the product risk — see biggest-risk note) | **Domain-expert validation of the calculator constants + colour fidelity before public launch** (a dated wk2 dependency); numbers from tested code only; decline path; ΔE colour check; safety gate; and an in-app **"this looks wrong"** report as the escape valve |
| **App Store / Play release readiness colliding with a compressed wk6** (the schedule risk) | Prove the full production/submission pipeline in **wk1** (enrollment, EAS prod, real store-track binary); read-only community avoids UGC-moderation review friction; disclosures drafted wk2 |
| **Image cost/latency at scale** | Cache + preset warming (few generations per *pattern*, not per user); **spend caps + rate limit + kill-switch in wk3**; faster/smaller tier on the warm path (see LATENCY_NOTE) |
| **Week 3 (swatch service) slips** | Split into core (wk3) + warming (wk4); if it still slips, warming → lazy generate-on-first-view and community → single share-screenshot — the two differentiators are untouched |
| **Two-person bandwidth / scope creep** | Hard cut list; weekly shippable milestone; lead owns saying no |
| **AI provider outage** | Provider-agnostic clients; calculators + tint + placeholder all work without the model; graceful degradation, never a blank/scary state |
| **Privacy / minors** | AI-content disclosure; a founder decision on age-gating (if under-18 users are allowed, data handling + store declarations change); in-app account deletion by wk5 |

### The single biggest risk (layered)

- **To the product:** a *confidently wrong* trusted number or swatch — not model
  hallucination (the calculator architecture handles that), but an **unvalidated
  constant or over-confident colour** that is deterministically wrong. In a
  sceptical community, one "the app cost me $40 of yarn" post is unrecoverable.
  Mitigation: expert constant-validation + the in-app report valve.
- **To the six-week deadline:** **store-review latency** — the only risk with hard
  external latency the team can't compress. Mitigation: prove the whole submission
  pipeline in Week 1.

If forced to one: the **trust** risk, because it's the product's reason to exist —
with store-release the close-second delivery risk.

## What the founder needs to provide

- **Domain validation (dated, by wk2):** sign-off on the yarn/needle constants and
  approximations, and on swatch colour fidelity — the numbers and images users buy
  on. This is a hard dependency, not a nice-to-have.
- **Content:** curated learning-guide content.
- **Brand:** name, visual identity, tone, and the preset colour palettes per project.
- **Accounts & budgets (early):** Apple Developer + Google Play accounts, AI
  provider keys + a monthly spend cap, CDN/hosting billing.
- **Legal/policy:** privacy policy, terms, **AI-content disclosure**, an
  **age-gating decision**, and the community-moderation posture (why read-only).
- **Availability:** a standing weekly scope/review call to keep the cut list honest.

## What I would cut first if we slip

Warming → lazy generate-on-first-view (cache still makes repeats instant);
community gallery → a single "share a screenshot" affordance; inventory → yarn
only; learning guides → fewer topics. The assistant and the planner+swatch preview
are **not** negotiable — they are the product. Shipping those two, trustworthy and
fast, on both stores in six weeks — and knowing from the metrics whether knitters
trusted them — is the win; everything else is a fast-follow.
