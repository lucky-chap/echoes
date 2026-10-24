# Worldlings — Littlehaven

A living pixel-art village in the existing Next.js app. Mia, Kai, and Luna keep their original sprites, paths, town artwork, procedural soundtrack and individual speaking sounds.

## Run

```sh
npm install
cp .env.example .env.local # only for a new setup; preserve an existing key
npm run dev
```

Start Event plays three connected scenes and pauses at a checkpoint. Continue plays another three. Next Event plays one scene. Pause, speed (1×/2×/4×), Reset World, separate music/SFX controls, and tab-visibility suspension are supported. Reset clears the village’s memories, not the server’s usage ledger. Memory persists within the page session, not across refreshes.

Residents meet in pairs while another pursues an independent activity. Morning, afternoon and evening lead into the next day. Clicking a resident reveals moods, recent memories, important promises/discoveries and friendships. Cultural evidence and numerical decision factors live in expandable diagnostics, never character speech.

## GroqCloud Free Plan

The only live LLM adapter is the official `groq-sdk`, with `openai/gpt-oss-120b`. No Google, Vertex, Gemini or xAI account is needed. No billing, credit purchases, plan upgrades or paid-provider switching are implemented.

Get a key from https://console.groq.com/keys and confirm the account is on the **Free Plan**. Set the server-only variables documented in `.env.example`. `GROQ_FREE_PLAN_CONFIRMED=true` is an operator assertion, not an API billing-tier check; a successful generation alone cannot prove an account’s billing tier. Configure request/token ceilings below the available account limits, including usage by other applications. Groq’s own Free Plan limits remain authoritative.

```sh
node scripts/verify-groq.mjs
```

Run this against the dev server (`WORLDLINGS_URL` defaults to `http://localhost:3000`). It makes a single scene request through the same validation and quota path used by the village. A transient server error may use the one permitted retry. It reports Groq Live only for an actual validated scene. Errors and offline scenes remain labeled Groq Mock / Mock Fallback. `.env.local` is ignored by Git.

Scenes use one request for all dialogue beats, strict JSON Schema output, and a second Zod/semantic validation pass. Prompts include profiles, moods, goals, current locations, bounded conversation context, relevant memories, relationships, cultural evidence, engine-selected plans and allowed actions. The engine owns destinations and movement. Invalid or ungrounded output falls back safely. The live generation schema limits the square encounter to expressive emotes, with travel executed afterward by the planner. Runtime validation also supports targeted actions: pointing requires a valid destination and walking is allowed only on the final beat to the engine-approved location. Emotes, bubbles, speaker-specific sounds and movement follow the playback clock. Memories and relationship changes apply after their referenced beats; activities and incidents commit after arrival.

### Bounded usage and deployment

- Default maximum: 10 live attempts per server-issued session, including retries. Automatic playback stops after three scenes; continuation requires a click.
- Daily request and conservative token reservations, minute ceilings, minimum spacing, 18-second request timeout and at most one transient 5xx retry. Authentication/429 errors pause live generation for that session. Token usage is recorded; account remaining-token/request headers constrain later reservations.
- Quota reservations happen **before** network I/O and persist in `.worldlings/quota.json`, protected by an atomic filesystem lock. New cookies, reset and refreshed browsers do not reset global ceilings. At most 100 sessions can be issued per UTC day.
- API requests require the same origin, bounded bodies and validated state. Credentials never reach the browser.
- Production live mode fails closed unless `WORLDLINGS_SINGLE_INSTANCE=true` and `WORLDLINGS_QUOTA_DIR` points to a persistent writable directory on a **single server**. Do not opt in on ephemeral/serverless or multiple independent instances. Those deployments run the mock simulation until an atomic shared quota backend is implemented. No paid infrastructure is required.
- A crashed process can leave the lock directory behind. It intentionally blocks live calls; after verifying no request is active, remove the stale `quota.lock` directory, preserving `quota.json`. Never delete the ledger to bypass the daily ceiling.

API docs checked: [Groq structured output](https://console.groq.com/docs/structured-outputs), [account-specific rate limits](https://console.groq.com/docs/rate-limits). The SDK disables implicit retries so every attempted request must obtain a reservation.

## Cultural evidence and destinations

The old Museum bias came from fixed taste-only scores and always selecting one group compromise. The living planner considers mood, energy, hunger/current goals, relationships, recent experiences, visit penalties, novelty, weather/events and small seeded variation. Residents select individually; a pair compromises only within a small loss window. There is no destination rotation or hard-coded winner.

`TasteProvider` is separate from `LLMProvider`. Qloo defaults to Mock while the key is pending. Mock cultural signals are explicitly illustrative and have **no fabricated affinity numbers**. To enable Qloo later, set `QLOO_MODE=live`, `QLOO_API_KEY`, and real cultural seed entity IDs for each resident using the variables in `.env.example`. The adapter queries artist recommendations through Qloo Insights, validates actual entities/affinities, caches successful results, and falls back on errors. It never looks up fictional village buildings. Real evidence affects local cultural-fit factors, dialogue context, discoveries and subsequently learned interests. Qloo Live appears only after successful real responses; this adapter has not yet been verified with a Qloo key.

## Modules

- `lib/world/living/planner.ts`: individual scoring, encounters, contextual incidents.
- `lib/world/living/engine.ts`: playback, movement, clock, bounded memories and relationships.
- `lib/world/living/validation.ts`: strict output schema and semantic validation.
- `lib/world/living/mock.ts`: replaceable offline scene provider.
- `lib/world/server/`: Groq, Qloo and durable server quota adapters.
- `app/api/world/`: same-origin scene/session routes.
- `components/world/use-world.ts`: bounded autoplay, fetch lifecycle, audio and controls.
- `lib/world/art.ts`, `movement.ts`, `audio/`: preserved town, paths and sound systems.

The original single-event engine remains for regression coverage; the UI now uses the living engine. Offline dialogue is templated and labeled honestly, while live Groq dialogue is generated from actual scene context.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
```

The regression suite covers the original renderer/audio plus multi-day scenes, independent routes, bounded memories, promise retention, invalid actions, memory commit timing, evidence-sensitive scoring and durable quota enforcement. Browser checks use an existing Playwright/Chromium installation:

```sh
WORLDLINGS_URL=http://localhost:3001 \
WORLDLINGS_PLAYWRIGHT_PATH=/path/to/playwright \
WORLDLINGS_BROWSER_PATH=/path/to/chromium \
node tests/living-browser.cjs
```

Run that test against a production server with default production live safeguards (mock mode). It checks connected scenes, pause, speed, checkpoints, rollover, memories, audio controls, mobile overflow, reset and API validation. Screenshots go to `/tmp/worldlings-living-{desktop,mobile}.png`.

Backlog: diaries, relationship timelines, knowledge-graph visualization, richer memory retrieval and cross-refresh persistence. No graph database is needed for this version.

## Live verification status (2026-10-24)

The account owner confirmed the Free Plan and 30 RPM. Real requests authenticated and reached `openai/gpt-oss-120b`, but a fully accepted live scene was **not** verified. Tests exposed Groq strict-schema compiler/validation errors; the latest live error was HTTP 400 `json_validate_failed` for an emotion outside the allowed enum. The schema and prompt were simplified/tightened afterward. Further live verification is blocked by the conservative daily token reservation ceiling (which was preserved). The interface remains Groq Mock until an actual validated request succeeds. Re-run `scripts/verify-groq.mjs` after the daily budget resets. Qloo remains Mock while its key is pending.
