# Echoes

Echoes helps a caregiver plan a gentle 30-minute reminiscence session for a person living with dementia. It supports activities, not treatment: it makes no clinical claims, uses first names only, and every plan tells the caregiver what is confirmed and what is not.

## The problem

Preparing a good reminiscence session is slow. A coordinator has to work out which years matter for this person, find music, TV, film and conversation topics from that time and place, check that dates and details are right, avoid topics that upset them, and then remember what worked last time. Echoes does the slow research and checking. The caregiver does the human part.

## How it works

1. The caregiver enters a first name, birth year, where the person grew up, country, language, up to three favourite things (artists, films, shows, books), things to avoid, and free-text notes.
2. Echoes works out the years when the person was about 10 to 25, then uses Qloo to find related music, TV, film and books from that era and place.
3. Every candidate passes local checks (release date, plausibility for the person's region, avoid list) before it reaches the plan. Held-back candidates are shown with their reason in the **What Qloo added** tab.
4. The plan is a timed running order with quiet pauses, gentle prompts that always include an easy way out, and invitations built from the caregiver's notes. Each item is labelled **You named this** or **From Qloo**.
5. After the session, the caregiver records what sparked a response, what wasn't for them, and anything that caused distress. The next session's plan uses that, and a **What changed since last time** panel says why.

## Where Qloo fits

Qloo supplies aggregate cultural and taste affinities. Echoes uses them as candidates, never as facts about the person: discoveries are labelled "personal familiarity is unconfirmed", and only the caregiver's observations count as evidence about the individual.

| Qloo request               | What is sent                                                                                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/search`                  | The favourite's name (or a normalised variant) and the entity type                                                                                                                                                                                   |
| `/v2/insights` (discovery) | Entity type, one seed entity ID, popularity floor, and where supported: release-year range (film, books), release-year maximum (TV), `filter.release_country` (film, TV), regional music tag IDs (artists), IDs to exclude after a distress response |
| `/v2/tags`                 | A country-derived query to find an exact regional music tag                                                                                                                                                                                          |

Findings from our live probes, which shaped the design:

- `filter.release_country` changed film results (a Cuban profile moved from US films to four Cuban films) and returned nothing for some country and domain pairs.
- Regional music tags changed artist results.
- Artist-level era parameters were accepted but did not constrain results, so every track is date-checked locally (MusicBrainz for music, TMDB for TV and film).
- Books have no effective region filter, so books are conversation topics only and pass a stricter gate.

The **What Qloo added** tab shows the real numbers for that plan from its stored trace: candidates returned per domain, how many passed our checks, how many were held back and why, and the filters sent. Empty values are omitted. The wording is aggregate and non-predictive: Qloo suggested candidates; familiarity is not confirmed.

### Redacted request-to-result example

Fictional profile (born 1948, Cuba, Spanish), film discovery seeded from the first resolved favourite:

```text
GET /v2/insights
  filter.type=urn:entity:movie
  signal.interests.entities=<seed entity ID>
  filter.release_year.min / max=<window from birth year>
  [with country filter] filter.release_country=<profile country>

Without the country filter: Lady Sings the Blues, Your Cheatin' Heart,
  Sunrise at Campobello, The Way We Were, St. Louis Blues
With the country filter:    Lucia, Memories of Underdevelopment,
  Death of a Bureaucrat, I Am Cuba
```

The second list is more regionally relevant, but those films are political, which this profile's avoid list excludes. That is why every candidate still goes through the avoid-list check. Qloo suggests, and local checks decide.

## What data goes where

| Service           | What it receives                                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qloo              | Favourite and item names, Qloo entity IDs, the resident's country (film/TV filter and music tag query), and release-year ranges derived from the birth year. Not sent: first name, notes, avoid list, feedback text, birth year itself.                                              |
| MusicBrainz, TMDB | Item titles and artist IDs for date lookups. No resident fields.                                                                                                                                                                                                                     |
| Groq              | (1) Intake: up to the first 6,000 characters of the caregiver's note, which may contain a name, birth year or avoid topics. (2) Prompt writing: item metadata, language, the avoid list, and preference traits. Not sent: first name, raw notes, birth year, country, feedback text. |

**Groq disclosure:** Echoes uses Groq-hosted language models to extract profile fields from the caregiver's note and to write session prompts. Groq is optional; without a key, both steps use local fallbacks.

Residents are stored in the browser (demo mode) or in an encrypted server file (protected mode) and are keyed by random IDs. The Qloo API key is only read server-side. Retries are bounded for every provider.

## Run locally

Requirements:

- Node.js **20.9 or newer**
- A Qloo API key
- A TMDB API key (film and TV date checks)
- A contact email for MusicBrainz (`MUSICBRAINZ_CONTACT_EMAIL`, live music date checks)
- A Groq API key is optional. Without it, intake uses a local fallback and prompt writing stays local.

```bash
git clone https://github.com/lucky-chap/echoes.git
cd echoes
npm install
cp .env.example .env.local
```

Add these values to `.env.local`:

```dotenv
QLOO_API_KEY=...
TMDB_API_KEY=...
MUSICBRAINZ_CONTACT_EMAIL=you@example.com

# Optional
GROQ_API_KEY=...
```

`QLOO_BASE_URL` defaults to `https://hackathon.api.qloo.com`. `QLOO_TIMEOUT_MS`, `GROQ_MODEL`, `DEMO_MODE`, and `ECHOES_CACHE_DIR` are optional tuning settings documented in `.env.example`.

Then start the app:

```bash
npm run dev
```

Open <http://localhost:3000> and choose **Explore a demo profile** (Dorothy).

Without protected-storage configuration, the app is a **fictional-data demo** using browser storage. Do not enter real resident information in this mode. Existing local workspaces are preserved and are not silently uploaded. Demo saves use IndexedDB, with localStorage as a fallback; the newest saved copy is loaded on refresh. Wait for "Saved in this browser" before leaving. Failed saves show a retry control and warn before unloading.

To check the configured Qloo host and key:

```bash
npm run qloo:smoke
```

## Demo walkthrough

1. Choose **Explore a demo profile** (Dorothy). If Dorothy has no saved session yet, review the prefilled profile and choose **Plan next session** (Session 1). Open the **What Qloo added** tab to see the trace-derived counts and held-back reasons.
2. Choose **Start your 30-minute session**, then **Finish early & wrap up**. Mark Elvis Presley as engaged and one of the Qloo discoveries as not for us, then save.
3. Return to the dashboard. Dorothy now has a reviewed **Session 1**. Choose **Plan next session** (Session 2). The **What changed since last time** panel shows what was kept, what was added because of the response, and what was left out.
4. To see the review prompt, start Session 2, leave it unwrapped, return to the dashboard, and choose **Plan next session**. The dialog offers **Review Session 2** or **Plan without review**.

The demo profiles are Dorothy, Margaret, and Robert, all fictional, with confirmed notes, preferences, and practical instructions.

## Sessions and review

- The dashboard groups saved kits by resident. Each session is numbered per resident in creation order and shown newest first.
- **Plan next session** creates a new kit and keeps every earlier kit. **Edit profile** changes the saved details without creating a kit.
- If the resident's latest session has no saved wrap-up, **Plan next session** asks whether to **Review Session N** first or to **Plan without review**. Planning without review adds a note to the new plan explaining that last time's responses are not reflected.
- **Add a new person** always starts from a blank form. It never copies another resident's details.
- A session counts as reviewed once its wrap-up is saved. A plan page has three tabs: **Overview**, **Tips**, and **What Qloo added**.

## Current MVP

An activity coordinator can maintain up to 60 profiles, select **one resident**, review a 30-minute plan, run it without mandatory feedback taps, and save a two-minute wrap-up. Observations and preferences inform the next session. Small-group planning is future scope; existing group records remain readable, but new group requests are rejected.

**Grounding and dates**

- Familiar favourites resolve through normalized names, aliases, or a caregiver-selected candidate. Favourites themselves are eligible candidates, alongside cross-domain discoveries.
- Displayed media needs MusicBrainz/TMDB date evidence within `[birth year + 10, birth year + 25]`; books need a Qloo-supplied publication year in that window. A provider outage is distinguished from a missing or out-of-window work. Unavailable facts are not cached as negative evidence.
- No verified media means a clearly labelled non-media plan, not fabricated recommendations.

**Orchestration**

- One bounded, policy-driven orchestrator calls structured tools. The four responsibilities are Cultural Researcher, Qloo Taste Explorer, Session Planner, and Response Adapter. These are real tool calls and branching policies, **not four autonomous LLM agents**.
- At most 64 tool invocations, bounded independent date checks, one broader discovery pass, and a 60-second deadline per kit. Qloo requests have a bounded retry.

**Plan and playback**

- Plans can be reviewed, reordered, removed, and replaced from verified alternatives. Timings remain 30 minutes; caregivers may pause, resume, or finish early.
- Spotify artist destinations are built only from Qloo-returned IDs and checked through Spotify oEmbed. A checked artist page does not guarantee a particular recording or regional playback. Every media item also has clearly labelled YouTube/Spotify search instructions. No invented video URLs.

**Feedback and memory**

- Feedback is optional during a session. Wrap-up choices include engagement, no response, distress, shared story, and not used. Blank means unrecorded, not no response.
- Memory separates caregiver-confirmed biography, caregiver-reported observations, and Qloo-suggested cultural discoveries, with timestamps and provenance. Qloo suggestions and reported stories are never automatically confirmed personal facts. Distress exclusions are retrieved separately from the recent-memory window.
- Notes are deterministic drafts of actual observations, editable and copyable. They do not assume that every planned activity was used. The About Me panel has a print layout.
- A collapsible trace records tool inputs, returned entity IDs/names, failures, date evidence, replanning, and the effect of previous feedback. The **What Qloo added** tab summarises that trace in plain language.

## Protected single-site pilot

Set all four server-only settings before using family intake:

```dotenv
ECHOES_STORAGE_KEY=<64 hex characters>
ECHOES_CAREGIVER_CODE=<unique passphrase of at least 12 characters>
ECHOES_ORIGIN=https://your-care-site.example
ECHOES_DATA_DIR=/absolute/path/on/a/durable/volume
```

Generate the encryption key with:

```bash
openssl rand -hex 32
```

HTTP is allowed only on localhost for development. Keep encryption keys and passphrases outside source control.

The current persistence adapter is for **one care-site workspace on a durable filesystem**, not ephemeral/serverless storage. It uses AES-256-GCM encrypted records, restrictive file permissions, an atomic cross-process write lock, atomic replacement, and revision checks to reject stale saves. It is not a distributed database. A crash can leave `write.lock`; recovery must be performed by an operator after confirming no writer is active. Back up both the encrypted data and its encryption key through your organisation's approved process. Losing the key means losing access to the data.

Caregiver access uses an HttpOnly, SameSite=Strict cookie (Secure on HTTPS). Sessions expire after 30 minutes; the tablet UI locks after five minutes of inactivity. There is also an explicit lock control. Protected workspace data is not stored in localStorage. Watch the save-status indicator before locking or leaving the page. Conflicts and failed saves do not overwrite other tablets' changes; reload the saved version only after resolving any unsaved edits.

This is a protected **pilot**, not a production compliance certification. Production use still requires organisation-specific review of consent, access policies, retention, backup/recovery, hosting, provider data agreements, and operational security. Shared site passphrases are not individual staff identities: SSO, role-based access, per-user audit logs, a durable edge rate limiter, and managed database storage remain future deployment work. Avoid storing clinical details or full identifiers. Discovery receives favourites and cultural context, not resident names or raw personal stories. Optional intake extraction sends the entered note to the configured language provider only after explicit authority confirmation.

## Family intake

1. Unlock the protected workspace and save the resident's profile.
2. Confirm authority to invite the intended contributor and create a private link.
3. The family provides birth year, hometown, favourites, memories, and topics to avoid; they must attest appropriate consent/authority. No diagnosis is requested.
4. A caregiver reviews the submission before accepting it. Accepting replaces the corresponding profile fields and records the family source.

Links contain random 256-bit bearer tokens in URL fragments. Tokens are hashed in storage, expire after seven days, are revocable, and can be submitted once. Issuing a replacement link revokes the previous one. The family form cannot read the resident profile or other care records. **Anyone holding an unused link can submit**; share it privately with the intended authorised contributor. Consent attestation is recorded; the app does not independently verify legal authority. Links are copied manually; the app sends no email.

Removing a resident clears their current profile, sessions, feedback, memories, pending submissions, and intake links. Application deletion cannot remove copies already exported or retained in operator-managed backups; manage those through the organisation's retention policy.

## Live Qloo feasibility

The audit was run **before expanding the workflow**, with fictional Ghanaian highlife, British rock, and American soul profiles. See [the findings](docs/echoes-feasibility.md) and [the recorded provider evidence](docs/qloo-feasibility.json).

The live run resolved five of six favourites. The remaining search failed at the network/request level, so it is not evidence that the artist is absent. Cross-domain results were returned, but geography and release era did not reliably align with the fictional resident. MusicBrainz independently confirmed in-window works for two sampled music results. TMDB was not configured in the audit environment; film/TV dates were therefore not independently verified. Request failures are recorded, never relabelled as empty catalogue coverage.

```bash
node scripts/echoes-feasibility.mjs
```

This makes at most 32 logical provider lookups (MusicBrainz retries remain throttled) and overwrites the generated audit artifact with a new timestamp. It does not send personal resident information. `/eval` separately runs the current pipeline on the three fictional profiles and reports exact favourite-resolution rate, displayed in-window rate, profile media coverage, and unavailable date checks. These are grounding metrics, not clinical outcomes.

To rerun the Qloo filter probe:

```bash
node scripts/probe-qloo-constraints.cjs
```

## Reliable date checks and demo preparation

MusicBrainz uses one process-wide queue (at least 1 second between request starts), `Echoes/0.1 (contact: MUSICBRAINZ_CONTACT_EMAIL)`, and up to three retries for 429/503/timeouts with exponential backoff, jitter, and Retry-After. Qloo MusicBrainz IDs avoid ambiguous artist searches. Every live MusicBrainz attempt logs URL, status, start time, latency, outcome, and User-Agent. Do not run multiple server processes or warm-up jobs against the same IP concurrently; this hackathon queue is shared within one Node process, not a distributed limiter.

Successful public provider responses and release catalogues are cached for 30 days in `.echoes-data/provider-cache` (or `ECHOES_CACHE_DIR`). Entries record source, fetch time, and expiry; atomic file replacement follows the existing JSON-store approach. Provider failures are not written to the long-lived cache. A cached catalogue can prove no checked work fits a different resident's window without calling the provider again. The cache contains no resident names or observations. No provider cache is committed to the repository. Mount it on durable storage in deployment; do not check it into source control. The Qloo client still needs `QLOO_API_KEY` to be present, even when cached responses are available.

```bash
npm run warm-demo
npm run check-demo-offline
```

Warm-up runs the existing generator sequentially for Dorothy, Margaret, and Robert against real APIs; it does not save canned plans. It exits non-zero for unresolved choices, unresolved favourites, or thin coverage caused by failed checks. The stricter offline check disables all fetches, reports cached labels, and exits non-zero for any remaining date failures. `DEMO_MODE=true` enables startup cache warnings and a 12-second overall cache-miss budget (MusicBrainz requests have a 2-second timeout). Warm-up uses a longer budget and should run before enabling demo mode.

Failed checks appear under **Checks still needed**, separate from verified coverage. **Retry checking** rechecks only failed candidates, preserves the kit ID and existing activity edits, and adds newly verified items to the plan or its alternatives. A lack-of-coverage banner requires a completed, conclusive date check; an outage alone never triggers it. Retrying an old saved kit without per-item date statuses requires preparing a fresh kit first.

The current verification results and limitations are in [the reliability report](docs/echoes-reliability.md), with [real HTTP timing evidence](docs/echoes-date-diagnostics.json).

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
# Fallback if Turbopack's local worker is blocked by the environment:
npx next build --webpack
```

Unit/integration tests use explicit fixtures for repeatable coverage of the loop, provenance, year gates, bounded replanning, memory, encryption, link lifecycle, and unsafe URLs. They are not labelled live API tests. The default test suite does not require provider credentials or network access.

An isolated browser test is supplied in `tests/echoes-copilot-browser.cjs`. It is not part of `npm test` because it requires Playwright/Chromium and permission to launch a local server/browser. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` can point at existing installations. It uses temporary encrypted storage and an intercepted, explicitly labelled discovery fixture. It checks tablet/mobile layouts, approval/editing, wrap-up persistence, next-session memory payloads, access controls, family submission/review, and stale-save rejection.

## Architecture

- `lib/echoes/pipeline.ts`: single bounded tool orchestrator and explicit failure/replan decisions.
- `lib/echoes/qloo.ts`, `year-facts.ts`, `media.ts`: fixed-host provider adapters, identity/date evidence, and media checks/search fallback.
- `lib/echoes/planner.ts`, `memory.ts`, `note.ts`: timed plans, provenance-aware retrieval/feedback, and grounded documentation.
- `lib/echoes/secure-store.ts`, `access.ts`, `storage-validation.ts`: encrypted pilot persistence, access boundaries, body limits, and runtime validation.
- `app/api/echoes`: thin routes for kits, access, workspace persistence, family intake/review, notes, and evaluation.
- `components/echoes`: resident dashboard, plan editor, optional live feedback, wrap-up, transparency panel, and protected access.

## Known limitations

- Qloo results describe aggregate affinities. They do not tell us what a particular person likes, and we do not present them that way. Every discovery is marked as unconfirmed.
- Coverage is strongest for Western music and TV. Some country and domain pairs return nothing, and the plan says so instead of filling the gap with generic items.
- Track choice relies on Qloo and MusicBrainz popularity data, which is incomplete for some artists. For those, the plan may offer an artist-level prompt instead of a single song.
- Items link to a search, not a playable track, so the caregiver previews the version and volume first.
- One resident per session kit. Group sessions are not built yet.
- Not clinically validated and not yet tested with real activity coordinators. The plans are suggestions for a caregiver to review, not care instructions.

## License and credits

[MIT](LICENSE). Data and services from Qloo, MusicBrainz, TMDB, and Groq. This product uses the TMDB API but is not endorsed or certified by TMDB.
