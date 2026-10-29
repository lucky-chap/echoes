# Echoes personalization diagnosis — 2026-10-29

Recorded before implementation. Existing working-tree changes are preserved. Baseline: 80 tests pass.

## Notes and storage

`components/echoes/echoes-app.tsx` has `intakeNote` in transient React state. Its extraction button sends `{note, authority}` to `/api/echoes/intake`; `lib/echoes/prose.ts` extracts only birth year, hometown, country, language, favourites and sensitivities. The original text and all other context are discarded, not persisted, and absent from `/api/echoes/kit`.

The second textarea writes `resident.importantMemories`. Contrary to the reported suspicion, `createKit` spreads the whole resident into the request; `residentSchema` retains importantMemories. `generateSessionKit` includes it in About Me, and `confirmProfile` records a biography after generation. But ranking, prompts, and pacing never read it. `planSession` only checks whether a confirmed biography exists, substituting a generic rationale. Thus text reaches the server but does not influence the plan.

`use-workspace.ts` saves demo workspaces in localStorage and protected workspaces through the encrypted server store. Both hold residents, feedback, sessions and memories. `relevantMemories` retrieves resident-scoped observations/biography (20 recent plus distress), excluding Qloo suggestions. Positive feedback or engaged/shared-story observations become entity-ID seeds; distress becomes an entity exclusion. There is no traits model, history import, or separate not-for-us status. Wrap-up and live buttons write feedback and observation memories; biography is not extracted into preferences.

## Discovery and dates

See `echoes-personalization-baseline.json` for raw normalized Qloo rows before local filtering, original traces, independent dates, and each single-seed diagnostic outcome. These are real cached responses, not fixtures. Missing cached requests are explicitly unavailable. TMDB is now configured.

The original orchestrator combines all eligible seed IDs in a request, so it cannot identify which individual seed caused a returned candidate. It nevertheless names `resident.lovedThings[0]` in every discovery reason. It checks favourites first, then takes three results per domain, with eight total date checks. It excludes out-of-window seeds from discovery. It does not trace candidates discarded by rank/deduplication/budget.

Cached Osibisa-only music results: Manu Dibango (Soul Makossa, 1973, verified), Matata (Air Fiesta, 1972, verified), ManDrill (checked dates outside the window), Peter King and African Music Machine (uncached date lookups). Film: A Clockwork Orange (avoid match), The Graduate (uncached date), Belarmino (1964 verified), To Kill a Mockingbird and Mean Streets (uncached dates). TV: Good Times, Great Performances, Kojak, The Mod Squad, Eight Hours Don't Make a Day (all dates uncached). Books: Slaughterhouse-Five, One Flew Over the Cuckoo's Nest and Breakfast of Champions match avoid metadata; Cat’s Cradle and God Bless You, Mr. Rosewater require publication-year checking. E.T. Mensah and Jim Reeves single-seed caches are absent in all four domains; this is not evidence of empty catalogue coverage.

Baseline combined-seed kit: Osibisa, Jim Reeves, Bobbie Gentry, Guess Who's Coming to Dinner. E.T. Mensah is out of window and appears only in explanatory text. The planner takes the first three items, omitting the verified film. The film survives in the kit pool. Alternatives are `verified.slice(3)` and every replacement menu offers that same list without domain filtering; no global hardcoded fallback was found.

## Prompts, pacing and links

`planner.ts` repeats one year-based music prompt, then a follow-the-thread prompt referring only to the first item/year. `rebalancePlan` divides 24 minutes equally among the middle activities; three media plus conversation becomes 18 uninterrupted media minutes. Reason arrays already contain periods but are joined with `. ` in the planner/replacement handler, producing double periods.

`media.ts` checks Spotify artist identity through oEmbed, not an individual playable work. Its search concatenates artist and work without deduplication. `media-links.tsx` renders all supplied links.

## Implementation sequence

1. One persisted notes field; migrate legacy fields; explicit confirmed preferences and shared response history; extraction/edit/import UI and tests.
2. Per-seed discovery, evidence weights, metadata/trait scoring, full rejection trace, named-favourite date exceptions, cross-domain selection and domain-specific alternatives.
3. Item-aware bounded LLM prompts with validation/fallback, pauses and 30-minute rebalancing, logistics, playable destinations/search, normalized prose.
4. Regression suite, protected/browser checks, build and A/B/C acceptance; record unavailable live evidence without inventing it.

Live diagnosis initially blocked by automatic approval review over profile-derived third-party requests. User authorization requested; cached evidence used meanwhile.
