# Echoes reliability verification — 28 October 2026

The existing generator, era window, session timer, feedback, review, and About Me sheet were retained. No provider dates or entities were hand-written into the production cache. Test fixtures live in temporary, separate caches.

## Diagnosis before implementation

The original Profile A run logged these actual MusicBrainz results:

| Query | HTTP | Latency | Result |
| --- | --- | --- | --- |
| Osibisa | 503 | 797 ms | Service failure |
| Jim Reeves | 200 | 298 ms | Multiple exact artist identities; the old code discarded them |
| Bobbie Gentry | 503 | 303 ms | Service failure |

There were no 429 responses, timeouts, or parse errors in that baseline run. Qloo returned E.T. Mensah for `ET Mensah`; the old punctuation-sensitive comparison rejected it. Two film checks were unavailable because `TMDB_API_KEY` is not configured. These failures were incorrectly accompanied by the generic thin-coverage banner.

## Changes

- Comparison normalization handles punctuation, whitespace, initials, diacritics, and `&`/`and`. Qloo aliases and MusicBrainz aliases/sort names participate. Ambiguous plausible candidates become a pick list, and the selected entity is saved in that resident's profile.
- MusicBrainz IDs from Qloo bypass ambiguous name searches. All app and diagnostic MusicBrainz calls use the same throttled, logged, retrying client. Timeouts begin after queue admission.
- Successful responses and release facts persist in an atomic JSON cache with source/fetch timestamps. In-window/out-of-window decisions are recomputed from cached facts for each resident; failures are not cached as missing dates.
- Each checked candidate records `verified_in_window`, `verified_out_of_window`, `unchecked_unavailable`, or `unknown_date`. Unavailable candidates are held back and do not enter the activity plan. Completed evidence and failed checks have separate messages.
- The retry endpoint checks only failed candidates, preserves the kit and existing edits, and makes newly dated media available without rerunning discovery. Known out-of-window favourites are not used to seed era-specific discovery.
- Demo warm-up and offline verification use the same Efua/Ray/Kofi profiles as the app. Startup preflight warns about missing or incomplete cache manifests. Cached MusicBrainz item details display `(cached)`.

## Acceptance results

| Check | Result |
| --- | --- |
| 1. ET Mensah spelling variants | Passed unit tests for all four spellings; live Qloo returned E.T. Mensah and warm-up resolved all of Efua's favourites. |
| 2. Cold-cache Profile A throttling and User-Agent | Passed: 8 live MusicBrainz requests, all HTTP 200; minimum start gap 1,840 ms. Configured contact email was sent. Full URL/status/latency logs are in `echoes-date-diagnostics.json`; the email is redacted in the checked-in artifact. |
| 3. Simulated 429 | Passed: 4 total attempts, Retry-After/backoff honored; exhaustion maps to `unchecked_unavailable`. Timeout retries and malformed JSON are also tested. |
| 4. Separate banners | Passed logic tests: failures alone do not show the few-dated-items message; failed items expose retry and a separate group. Browser rendering remains unverified. |
| 5. Retry only failures | Passed integration test: completed candidates are not called again, kit ID persists, newly verified media appears, and duration remains 30 minutes. |
| 6. Offline A/B/C | All three return complete 30-minute plans with **zero fetches**; every displayed dated item is cached. Efua has 3 dated picks, Ray 3, Kofi 0. **Incomplete acceptance:** Ray still has 3 unavailable film/TV dates because TMDB is not configured. Offline verification correctly exits 1 rather than claiming full readiness. |
| 7. Kofi/Daddy Lumba, born 1950 | Passed live-cache/offline and unit checks: thin coverage, zero media picks after 1975, full non-media plan. |
| 8. Existing checks and Begin Session | 80 tests passed; TypeScript, ESLint, and webpack production build passed. Browser launch was declined, so timer/button interaction assertions were not executed. The existing browser script has been updated for current navigation and tabs. |

Cold-cache request starts included `18:46:17.493Z`, `18:46:19.333Z`, `18:46:22.917Z`, `18:46:26.805Z`, and `18:46:30.780Z`. The later requests remain spaced by more than one second. See the JSON artifact for all eight.

## Limits and next verification

Set `TMDB_API_KEY`, rerun `npm run warm-demo`, then `npm run check-demo-offline` to finish the film/TV acceptance check. No replacement dates were invented. The cache is local and ignored by Git; provision a durable cache directory when deploying.

The supplied Efua history names an unspecified Jim Reeves ballad as “not for us.” There is no track title or provider ID to identify that stimulus. The warm-up uses live-resolved positive Osibisa/Mensah history but does **not** invent a ballad ID or exclude the entire Jim Reeves catalogue. That specific history case remains unverified until a track is identified. Existing entity-scoped distress exclusions remain tested.

MusicBrainz catalogues are paged up to 500 release groups; an incomplete catalogue is `unknown_date`, never proof of no in-window work. The limiter is process-wide, so use one server process and run the warm-up separately. Multi-process coordination would require a shared limiter beyond this hackathon scope.
