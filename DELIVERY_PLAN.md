# DELIVERY_PLAN — full product to MVP in 6 weeks

**Goal:** ship a knitters' mobile app to the App Store and Google Play in 6 weeks.
**Team:** 1 frontend (React Native) + 1 backend (Python). **My role:** technical
lead — architecture, scope calls, review, unblock, and own the store submissions.

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
| Inventory (minimal: add yarn/needle, list) | Web app; iPad-optimised layouts |

**Rationale:** the assistant (trust) and the planner+swatch (the visual hook) are
the product's reason to exist and its two hardest technical bets, so they get the
build effort. Guides are content, not engineering. Community and inventory ship as
thin slices that prove the shape without the depth.

## Architecture (thin, boring, shippable)

- **Frontend:** React Native (Expo for fast store builds + OTA updates).
- **Backend:** Python (FastAPI), Postgres, object storage + CDN for swatch images,
  a job/queue worker for image warming.
- **AI:** LLM provider behind our own endpoint (assistant *understands/phrases*;
  numbers come from the calculator service — the PoC pattern). Image model behind a
  swatch service with the cache + tint + warm pipeline from the PoC.
- **Key principle carried from the PoC:** deterministic calculators are the source
  of truth; every generated image is cached and colour is applied in code. This is
  what lets a two-person team ship something *trustworthy* fast.

## Weekly plan

| Wk | Frontend (RN) | Backend (Python) | Milestone / demo |
|---|---|---|---|
| **1** | App shell, navigation, design system, auth screens | Auth + user model, Postgres, CI/deploy, port the **calculator service** | Empty app runs on both stores via TestFlight/Internal testing; auth works |
| **2** | Assistant chat UI; planner input form (dimensions, stitch, colour) | Assistant endpoint (LLM + verified numbers, decline path); calculator API | **Assistant answers for real**, on device |
| **3** | Swatch preview screen (hero image, colour chips, zoom); placeholder→swap | **Swatch service**: prompt→generate→cache→tint→fallback; preset warming worker | **Swatch preview live**; tap-a-colour is instant (cached/tinted) |
| **4** | Learning guides (bundled content reader); inventory list add/edit | Content delivery; inventory CRUD; image CDN + cost/rate guards | Guides + inventory usable; end-to-end planner→preview |
| **5** | Read-only community gallery; polish, empty states, error states | Moderation/safety gate on generated + shared images; observability, cost caps | Feature-complete MVP; internal dogfood build |
| **6** | Bug bash, accessibility, store assets (screenshots, copy) | Load/cost test, backups, privacy endpoints (data export/delete) | **Submit to App Store + Google Play**; buffer for review feedback |

**Store timing is a first-class dependency, not week 6 work:** the app is in
TestFlight / Play Internal testing from **week 1**, so review-account setup,
certificates, and metadata are solved early and the week-6 submission is a
formality with a few days of buffer for reviewer questions.

## Critical-path dependencies

1. **Auth (wk1) → inventory + community + personalised assistant.** Everything
   user-scoped waits on it, so it's first.
2. **Swatch service (wk3) → swatch UI.** The backend cache/tint/warm pipeline must
   exist before the FE can make the preview feel instant; the FE builds against a
   mocked contract in wk2 to avoid stalling.
3. **Image CDN + cost guards (wk4) before any wide testing**, or a warming bug
   burns budget.
4. **Store accounts + certs (wk1)** or week-6 submission slips.

## Top risks & mitigations

| Risk | Mitigation |
|---|---|
| **AI trust** — a wrong number or a bad swatch damages the brand with a sceptical community | Numbers from tested calculators only, assistant declines when unsure; presets generated natively; colour verified (ΔE); safety gate on images before display |
| **Image cost/latency at scale** | Cache + preset warming (few generations per pattern, not per user); cost caps + alerts; faster/smaller tier on the warm path (see LATENCY_NOTE) |
| **App-store review delay** | In store test tracks from wk1; submit wk6 with buffer; nothing in MVP that trips review (no unmoderated UGC at launch → community is read-only) |
| **Two-person bandwidth / scope creep** | Hard cut list above; weekly shippable milestone; lead owns saying no |
| **AI provider outage** | Provider-agnostic clients; calculators + tint + placeholder all work without the model; graceful degradation, never a blank/scary state |

## What the founder needs to provide

- **Domain data & content:** curated learning-guide content, and sign-off on the
  yarn/needle constants and approximations (the numbers users will trust).
- **Brand:** name, visual identity, tone, and the preset colour palettes per project.
- **Accounts & budgets:** Apple Developer + Google Play accounts (early), AI
  provider keys and a monthly spend cap, CDN/hosting billing.
- **Legal/policy:** privacy policy, terms, and a decision on community moderation
  posture (why community is read-only at launch).
- **Availability:** a standing weekly scope/review call to keep the cut list honest.

## What I would cut first if we slip

Community gallery → a single "share a screenshot" affordance; inventory → yarn only;
learning guides → fewer topics. The assistant and the planner+swatch preview are
**not** negotiable — they are the product. Shipping those two, trustworthy and fast,
on both stores in six weeks is the win; everything else is a fast-follow.
