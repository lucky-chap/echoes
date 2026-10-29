# Echoes

Echoes is a caregiver copilot for personalised reminiscence activities. Memory care is the starting point, not a diagnosis requirement. It supports activity preparation and documentation—not diagnosis, treatment, or clinical outcome claims.

## Current MVP

An activity coordinator can maintain up to 60 profiles, select **one resident**, review a 30-minute plan, run it without mandatory feedback taps, and save a two-minute wrap-up. Observations and preferences inform the next session. Small-group planning is future scope; existing group records remain readable, but new group requests are rejected.

- Familiar favourites resolve through normalized names, aliases, or a caregiver-selected candidate. Favourites themselves are eligible candidates, alongside cross-domain discoveries.
- Displayed media needs MusicBrainz/TMDB date evidence within `[birth year + 10, birth year + 25]`; books need a Qloo-supplied publication year in that window. A provider outage is distinguished from a missing or out-of-window work. Unavailable facts are not cached as negative evidence.
- One bounded, policy-driven orchestrator calls structured tools. The four responsibilities are Cultural Researcher, Qloo Taste Explorer, Session Planner, and Response Adapter. These are real tool calls and branching policies, **not four autonomous LLM agents**.
- At most 30 tool invocations, eight dated candidates, one broader discovery pass, and a 60-second deadline per kit. Qloo requests have a bounded retry. No verified media means a clearly labelled non-media plan, not fabricated recommendations.
- Plans can be reviewed, reordered, removed, and replaced from verified alternatives. Timings remain 30 minutes; caregivers may pause, resume, or finish early.
- Spotify artist destinations are built only from Qloo-returned IDs and checked through Spotify oEmbed. A checked artist page does not guarantee a particular recording or regional playback. Every media item also has clearly labelled YouTube/Spotify search instructions. No invented video URLs.
- Feedback is optional during a session. Wrap-up choices include engagement, no response, distress, shared story, and not used. Blank means unrecorded, not no response.
- Memory separates caregiver-confirmed biography, caregiver-reported observations, and Qloo-suggested cultural discoveries, with timestamps and provenance. Qloo suggestions and reported stories are never automatically confirmed personal facts. Distress exclusions are retrieved separately from the recent-memory window.
- Notes are deterministic drafts of actual observations, editable and copyable. They do not assume that every planned activity was used. The About Me panel has a print layout.
- A collapsible trace records tool inputs, returned entity IDs/names, failures, date evidence, replanning, and the effect of previous feedback.

## Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

Configure server-only `QLOO_API_KEY`, `TMDB_API_KEY`, and `MUSICBRAINZ_CONTACT_EMAIL`. The Qloo host is pinned to `https://hackathon.api.qloo.com`. `GROQ_API_KEY` is optional for caregiver-requested intake extraction; review extracted fields before using them. It is not used to invent recommendations or write session notes.

Without protected-storage configuration, the app is a **fictional-data demo** using browser storage. Do not enter real resident information in this mode. Existing local workspaces are preserved and are not silently uploaded. Demo saves use IndexedDB, with localStorage as a fallback; the newest saved copy is loaded on refresh. Wait for “Saved in this browser” before leaving. Failed saves show a retry control and warn before unloading.

## Protected single-site pilot

Set all four server-only settings before using family intake:

```env
ECHOES_STORAGE_KEY=<64 hex characters; generate using openssl rand -hex 32>
ECHOES_CAREGIVER_CODE=<unique passphrase of at least 12 characters>
ECHOES_ORIGIN=https://your-care-site.example
ECHOES_DATA_DIR=/absolute/path/on/a/durable/volume
```

HTTP is allowed only on localhost for development. Keep encryption keys and passphrases outside source control. No keys are generated into your real deployment by this implementation.

The current persistence adapter is for **one care-site workspace on a durable filesystem**, not ephemeral/serverless storage. It uses AES-256-GCM encrypted records, restrictive file permissions, an atomic cross-process write lock, atomic replacement, and revision checks to reject stale saves. It is not a distributed database. A crash can leave `write.lock`; recovery must be performed by an operator after confirming no writer is active. Back up both the encrypted data and its encryption key through your organisation’s approved process. Losing the key means losing access to the data.

Caregiver access uses an HttpOnly, SameSite=Strict cookie (Secure on HTTPS). Sessions expire after 30 minutes; the tablet UI locks after five minutes of inactivity. There is also an explicit lock control. Protected workspace data is not stored in localStorage. Watch the save-status indicator before locking or leaving the page. Conflicts and failed saves do not overwrite other tablets’ changes; reload the saved version only after resolving any unsaved edits.

This is a protected **pilot**, not a production compliance certification. Production use still requires organisation-specific review of consent, access policies, retention, backup/recovery, hosting, provider data agreements, and operational security. Shared site passphrases are not individual staff identities: SSO, role-based access, per-user audit logs, a durable edge rate limiter, and managed database storage remain future deployment work. Avoid storing clinical details or full identifiers. Discovery receives favourites and cultural context, not resident names or raw personal stories. Optional intake extraction sends the entered note to the configured language provider only after explicit authority confirmation.

## Family intake

1. Unlock the protected workspace and save the resident’s profile.
2. Confirm authority to invite the intended contributor and create a private link.
3. The family provides birth year, hometown, favourites, memories, and topics to avoid; they must attest appropriate consent/authority. No diagnosis is requested.
4. A caregiver reviews the submission before accepting it. Accepting replaces the corresponding profile fields and records the family source.

Links contain random 256-bit bearer tokens in URL fragments. Tokens are hashed in storage, expire after seven days, are revocable, and can be submitted once. Issuing a replacement link revokes the previous one. The family form cannot read the resident profile or other care records. **Anyone holding an unused link can submit**; share it privately with the intended authorised contributor. Consent attestation is recorded; the app does not independently verify legal authority. Links are copied manually; the app sends no email.

Removing a resident clears their current profile, sessions, feedback, memories, pending submissions, and intake links. Application deletion cannot remove copies already exported or retained in operator-managed backups; manage those through the organisation’s retention policy.

## Live Qloo feasibility

The audit was run **before expanding the workflow**, with fictional Ghanaian highlife, British rock, and American soul profiles. See [the findings](docs/echoes-feasibility.md) and [the recorded provider evidence](docs/qloo-feasibility.json).

The live run resolved five of six favourites. The remaining search failed at the network/request level, so it is not evidence that the artist is absent. Cross-domain results were returned, but geography and release era did not reliably align with the fictional resident. MusicBrainz independently confirmed in-window works for two sampled music results. TMDB was not configured in the audit environment; film/TV dates were therefore not independently verified. Request failures are recorded, never relabelled as empty catalogue coverage.

```sh
node scripts/echoes-feasibility.mjs
```

This makes at most 32 logical provider lookups (MusicBrainz retries remain throttled) and overwrites the generated audit artifact with a new timestamp. It does not send personal resident information. `/eval` separately runs the current pipeline on the three fictional profiles and reports exact favourite-resolution rate, displayed in-window rate, profile media coverage, and unavailable date checks. These are grounding metrics, not clinical outcomes.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
# Fallback if Turbopack's local worker is blocked by the environment:
npx next build --webpack
```

Unit/integration tests use explicit fixtures for repeatable coverage of the loop, provenance, year gates, bounded replanning, memory, encryption, link lifecycle, and unsafe URLs. They are not labelled live API tests.

An isolated browser test is supplied in `tests/echoes-copilot-browser.cjs`. It requires Playwright/Chromium and permission to launch a local server/browser. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point at existing installations. It uses temporary encrypted storage and an intercepted, explicitly labelled discovery fixture. It checks tablet/mobile layouts, approval/editing, wrap-up persistence, next-session memory payloads, access controls, family submission/review, and stale-save rejection. Browser execution was not completed in this implementation session because launch permission was declined; do not treat those assertions as passed.

## Architecture

- `lib/echoes/pipeline.ts`: single bounded tool orchestrator and explicit failure/replan decisions.
- `qloo.ts`, `year-facts.ts`, `media.ts`: fixed-host provider adapters, identity/date evidence, and media checks/search fallback.
- `planner.ts`, `memory.ts`, `note.ts`: timed plans, provenance-aware retrieval/feedback, and grounded documentation.
- `secure-store.ts`, `access.ts`, `storage-validation.ts`: encrypted pilot persistence, access boundaries, body limits, and runtime validation.
- `app/api/echoes`: thin routes for kits, access, workspace persistence, family intake/review, notes, and evaluation.
- `components/echoes`: existing visual system extended with resident directory, plan editor, optional live feedback, wrap-up, provenance panel, and protected access.

Historical Worldlings files are retained; this change does not rewrite unrelated simulation code.

## License

[MIT](LICENSE)

## Reliable date checks and demo preparation

MusicBrainz uses one process-wide queue (at least 1 second between request starts), `Echoes/0.1 (contact: MUSICBRAINZ_CONTACT_EMAIL)`, and up to three retries for 429/503/timeouts with exponential backoff, jitter, and Retry-After. Qloo MusicBrainz IDs avoid ambiguous artist searches. Every live MusicBrainz attempt logs URL, status, start time, latency, outcome, and User-Agent. Do not run multiple server processes or warm-up jobs against the same IP concurrently; this hackathon queue is shared within one Node process, not a distributed limiter.

Successful public provider responses and release catalogues are cached for 30 days in `.echoes-data/provider-cache` (or `ECHOES_CACHE_DIR`). Entries record source, fetch time, and expiry; atomic file replacement follows the existing JSON-store approach. Provider failures are not written to the long-lived cache. A cached catalogue can prove no checked work fits a different resident's window without calling the provider again. The cache contains no resident names or observations. Mount it on durable storage in deployment; do not check it into source control.

```sh
npm run warm-demo
npm run check-demo-offline
```

The app and warm-up use Dorothy, Margaret, and Robert, with confirmed notes, preferences, and practical instructions. Warm-up runs the existing generator sequentially against real APIs; it does not save canned plans. It exits non-zero for unresolved choices, unresolved favourites, or thin coverage caused by failed checks. The stricter offline check disables all fetches, reports cached labels, and exits non-zero for any remaining date failures. `DEMO_MODE=true` enables startup cache warnings and a 12-second overall cache-miss budget (MusicBrainz requests have a 2-second timeout). Warm-up uses a longer budget and should run before enabling demo mode.

Failed checks appear under **Not yet checked**, separate from verified coverage. **Retry checking** rechecks only failed candidates, preserves the kit ID and existing activity edits, and adds newly verified items to the plan or its alternatives. A lack-of-coverage banner requires a completed, conclusive date check; an outage alone never triggers it. Retrying an old saved kit without per-item date statuses requires preparing a fresh kit first.

The current verification results and limitations are in [the reliability report](docs/echoes-reliability.md), with [real HTTP timing evidence](docs/echoes-date-diagnostics.json).
