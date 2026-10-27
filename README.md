# Worldlings — Littlehaven

Littlehaven is a persistent pixel-art town simulation for Mia, Kai, and Luna. Qloo supplies verified cultural entities and recommendations, the simulation owns decisions and world state, and Groq supplies dialogue only when a generated scene passes structural and grounding checks.

## Run

```sh
npm install
cp .env.example .env.local # only on a new setup; never overwrite existing keys
npm run dev
```

Configure the server-only integrations in `.env.local`:

```env
QLOO_API_KEY=your_actual_key_here
QLOO_BASE_URL=https://hackathon.api.qloo.com
QLOO_TIMEOUT_MS=7000

GROQ_API_KEY=your_groq_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

`QLOO_API_KEY` is read only by server code. The client calls the same-origin Worldlings route and never receives the key, raw headers, or upstream request credentials. The Qloo client refuses every origin except `https://hackathon.api.qloo.com`.

## Cultural loop

Each resident starts with different configured interests:

- Mia: *Before Sunrise* and Norah Jones; discovers films.
- Kai: Kendrick Lamar and *Spider-Man: Into the Spider-Verse*; discovers artists.
- Luna: Miles Davis and *The Little Prince*; discovers books.

On the first request, `/search` resolves those names to actual Qloo entity IDs. `/v2/insights` then uses each resident's own verified IDs, exclusions, result type, and optional explainability. Search results are cached for 24 hours and Insights results for one hour; expired real data can be used for one additional day during an outage and is explicitly labeled `CACHED Qloo`. Authentication, rate-limit, timeout, schema, and empty-result failures are exposed. There is no production mock recommendation provider or silent fake fallback.

The decision loop is:

1. Resolve and store verified Qloo interests.
2. Fetch a small personalized recommendation batch when a scene needs cultural input.
3. Evaluate a new entity against mood, goal, energy, visits, social context, and available Littlehaven activities. Qloo affinity is preserved as upstream evidence and passed through a bounded simulation influence; it is not interpreted as a probability.
4. Listen at The Green Room, read at the Museum, arrange a movie activity at The Daily Cup, or save an unsupported entity. A real place remains a referenced real place and is never represented as a building in Littlehaven.
5. Record `discovered`, `considered`, `liked`, `disliked`, or `dismissed` independently.
6. Add only liked, experienced entities to eligible future Qloo signals. Preserve Qloo's original score and record simulation preference changes separately.

Memory, discoveries, taste changes, social memories, relationships, and completed gatherings survive refreshes in validated local storage. Data sent back to the server is size-bounded and validated before it can enter a prompt.

## Gatherings and dialogue

Gatherings include an organizer, invitations and responses, a town venue, scheduled simulation time, timeout, reason, optional Qloo entity, and lifecycle state. Residents walk over existing routes. The engine checks physical occupancy at the meeting venue before every line; absent residents cannot speak or receive social-memory updates. A compatible late arrival can join only after reaching that venue.

After dispersal, arrivals at the café, music venue, and museum create bounded, persisted conversation opportunities. Shared visits take priority, including pairs; lone residents can have a short spoken thought. These conversations happen at the actual venue before the simulation clock advances. Each uses the normal Groq budget and validation; unavailable dialogue stays silent and is labelled in the UI.

Completed sketching, dancing and sitting actions create factual memories, adjust energy, and add a small bounded art/music/quiet preference used by later destination scoring. Completed venue conversations reduce social need and modestly strengthen the attending residents' relationships. Unplayed actions and silent fallbacks cannot create these effects. These are local simulation preferences, never invented Qloo affinities or verified entities.

Natural scheduling considers social need, relationships, energy, prior participants, physical overlap, cultural discoveries, and public events. A reliable all-three public gathering is scheduled by the third scene on day one, using the same invitation, walking, arrival, occupancy, and dialogue path as every other gathering. Independent destination choices continue after the meeting.

The scene director supports casual encounters, group hangouts, disagreements, discovery scenes, unexpected events, and personal moments. Groq receives the exact roster, arrival boundary, moods, current goals, relationships, bounded relevant memories, real Qloo discoveries, and confirmed-fact IDs. It cannot authorize movement or directly mutate world state. Output is rejected for absent speakers, invalid actions, ungrounded callbacks, unknown evidence, repeated lines/sequences, bad attribution, or unsupported state changes. An outage produces a silent fallback while independent activities continue.

## Development diagnostics

### Dialogue continuity and optional backup

Each request returns a whole conversation (up to ten beats). Prompts include
one compact evidence set and recent-line sample instead of repeated resident
histories. Server validation still checks the entire bounded history.

While a live scene plays, the client projects its deterministic completion and
prefetches one next scene. It reuses that response only if the complete validated
world matches the projection. Reset/context changes invalidate it; speculative
calls still count against quotas. Prefetching does not pause movement or audio.

Groq is the primary provider. To enable the optional Cerebras backup, set these
server-only values in `.env.local` (do not overwrite existing credentials):

```env
CEREBRAS_BACKUP_ENABLED=true
CEREBRAS_API_KEY=your_actual_key_here
CEREBRAS_MODEL=qwen-3.8-27b
CEREBRAS_DAILY_REQUEST_LIMIT=20
CEREBRAS_REQUESTS_PER_MINUTE=2
CEREBRAS_TOKENS_PER_MINUTE=20000
CEREBRAS_DAILY_TOKEN_LIMIT=60000
```

Adjust those ceilings to your account's actual allowances before enabling it.
The integration uses Cerebras' [structured output API](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
at the fixed `https://api.cerebras.ai/v1` endpoint. Backup prose passes exactly
the same attendance, schema, grounding and repetition checks. Diagnostics show
`Cerebras Live` when it supplies an accepted scene, plus the failover reason.
Without configuration it makes no backup calls. With backup enabled there are
at most two attempts: one primary and one backup. A 429 sets that provider's
cooldown; it is not immediately retried. Both providers share the application
budget (at most 25 requests in a rolling minute) and session call ceiling, with
separate persistent provider request/token ceilings.

`GROQ_PLAN=free` is the default. After upgrading your own Groq account and
configuring its [spending cap](https://console.groq.com/docs/spend-limits), use
`GROQ_PLAN=developer` and `GROQ_PAID_USAGE_CONFIRMED=true`; then set the existing
`GROQ_*LIMIT` and per-minute settings below your actual account limits. This
does not upgrade the account or raise ceilings automatically. The app caps
requests at 25/minute even on Developer, and token ceilings remain configurable.
`MAX_LLM_CALLS_PER_SESSION` defaults to 60; an existing explicit value of 10 in
your local environment still wins. Restart the server after changing settings.

All provider failover tests use isolated transports, not live paid requests.

Expand **Cultural signals & developer inspection** to inspect:

- Qloo configuration, fixed host, last authenticated success, request categories, cache state, last error, live/cached request counts, real recommendation count, entity IDs, sources, and unmodified affinities.
- The latest Qloo-driven resident decision, input entity IDs, simulation rationale, action, completion, and preference update.
- Groq source, model, status, attempts, token use, validation result, scene roster, actual square occupants, movements, gatherings, and destination score factors.

No secrets or upstream authentication headers are included.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
node scripts/verify-qloo.mjs
```

The Qloo verifier makes one authenticated search and one personalized Insights request for each resident, validates entity IDs and names, and prints counts and non-secret evidence. On 2026-10-25 it completed 6 live requests against the hackathon host: 3 searches and 3 Insights requests. Mia received films (*Before Sunset*, *Before Midnight*, *Eternal Sunshine of the Spotless Mind*), Kai received artists (Tyler, the Creator; A$AP Rocky; ScHoolboy Q), and Luna received books (*Witch of the Glens*, *Animal Farm*, *The Metamorphosis*).

Run the Groq endpoint verifier against a running server:

```sh
node scripts/verify-groq.mjs
```

Browser checks can use an existing Playwright/Chromium installation:

```sh
WORLDLINGS_URL=http://localhost:3000 \
WORLDLINGS_PLAYWRIGHT_PATH=/path/to/playwright \
WORLDLINGS_BROWSER_PATH=/path/to/chromium \
node tests/living-browser.cjs
```

The automated suite uses isolated fake transports for API error/schema contracts and test-only authored dialogue fixtures. These do not count as live Qloo or Groq success. Live verification is reported separately.

## Root causes fixed

The social failure came from a planner limited to fixed pairs, a dialogue fallback that destructured two residents, and movement code that sent non-selected residents away before speech. There was no authoritative attendance or arrival boundary. The current planner evaluates every resident subset, the engine maintains active presence and per-resident transit, and validation ties every utterance and state update to physical attendance.

The repetitive dialogue came from a production fallback line bank rotated by scene number, not from a dialogue cache. Both the API and browser error path invoked it, and callbacks could misattribute stored memories. That template system and the obsolete score-based demo engine were deleted. Fallback is now silent; accepted Groq scenes use bounded history, reply links, grounded evidence, participant validation, and exact/near/sequence repetition detection.

The cultural failure came from requiring manually invented environment IDs and replacing every error with illustrative `mockSignals`. The new client resolves actual IDs, validates and normalizes live schemas, maintains provenance, and returns an explicit unavailable/error state when it has no cached real response.

## Main modules

- `lib/world/server/qloo.ts` — fixed-host client, search, Insights, schema validation, retry, throttling, deduplication, caching, normalization, and profile initialization.
- `lib/world/living/planner.ts` — local decisions, cultural activity mapping, social intents, invitations, group scheduling, and scene selection.
- `lib/world/living/engine.ts` — movement, attendance, dialogue playback, outcomes, discoveries, memories, relationships, and feedback.
- `lib/world/living/validation.ts` — bounded snapshot validation and strict scene semantics.
- `lib/world/server/groq.ts` — contextual structured dialogue generation.
- `app/api/world/scene/route.ts` — same-origin server orchestration; credentials remain server-side.
- `components/world/use-world.ts` — playback lifecycle and validated persistence.

Official contracts reviewed: [Qloo entity search](https://github.com/qloo/docs-public/blob/main/reference/get-search.md), [Qloo Insights](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md), and [Qloo authentication](https://github.com/qloo/docs-public/blob/main/reference/api-onboarding.md).

## Known limits

- Memory is persistent per browser, not synchronized across devices or accounts.
- There is no vector database or interactive connections graph.
- Qloo entity coverage and explainability vary by result; missing explainability remains `null` and is never invented.
- Live Groq prose quality still depends on model availability and quota. Rejected or unavailable output never blocks walking or independent routines.
