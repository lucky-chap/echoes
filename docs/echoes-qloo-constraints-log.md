# Qloo constraint and feedback-loop log

Recorded: 2026-10-29T13:07:30.726Z

## Result

Moved verified request constraints into the existing Echoes discovery flow. No app rebuild and no feedback-loop reimplementation.

| Domain | Era sent to Qloo | Region sent to Qloo | Still checked locally |
| --- | --- | --- | --- |
| Film | `filter.release_year.min/max` (already present) | `filter.release_country=<profile country>` (new) | Exact date, relevance, avoid list. |
| TV | `filter.release_year.max` (already present) | `filter.release_country=<profile country>` (new) | First/last-air overlap; a lower first-air bound would incorrectly remove older ongoing series. |
| Music artist | No verified artist-era filter | Exact country music tag from `/v2/tags`, sent as `filter.tags` with `operator.filter.tags=union` (new, where a tag exists) | Track release year, regional/seed relevance, avoid list. |
| Book | `filter.publication_year.min/max` (already present) | No effective country filter established | Publication date, relevance, avoid list; conversation only. |

The broader retry keeps era and region constraints; it only removes the popularity floor. If no exact regional music tag is returned, the request does not invent one and local relevance checks remain mandatory. `filter.location.query` is now restricted to place requests because a place-location filter is not a media-origin filter.

## Live provider checks

These were real read-only requests to `https://hackathon.api.qloo.com`, using the profile’s first resolved music favourite as the seed. Request parameters, HTTP status, complete JSON results and names are retained in [the raw probe log](qloo-constraint-probe.json). API keys and headers are not included. Public documentation could not be accessed in this session; the conclusions below are based on measured behavior, not a claim of an exhaustive API specification.

| Profile / domain | Before region constraint | With region constraint |
| --- | --- | --- |
| Dorothy / movie | 5 items: St. Louis Blues, West Side Story, The Sound of Music, Funny Girl, Gypsy | HTTP 200; 5 items: St. Louis Blues, West Side Story, The Sound of Music, Funny Girl, Gypsy |
| Dorothy / tv_show | 5 items: Julia, Room 222, Here's Lucy, General Hospital, Days of Our Lives | HTTP 200; 5 items: Julia, Room 222, Here's Lucy, General Hospital, Days of Our Lives |
| Dorothy / artist | 5 items: Etta James, Gladys Knight & The Pips, Stevie Wonder, Marvin Gaye, Ray Charles | No exact country music tag returned; local check retained. |
| Dorothy / book | 5 items: Lord of the Flies, One Flew Over the Cuckoo's Nest, The Bell Jar, Flowers for Algernon, Lolita | HTTP 200; 5 items: Lord of the Flies, One Flew Over the Cuckoo's Nest, The Bell Jar, Flowers for Algernon, Lolita |
| Yaw / movie | 5 items: The Diary of Anne Frank, The Quiet American, Naked Among Wolves, Cairo 30, The Shop on Main Street | HTTP 200; 0 items: none |
| Yaw / tv_show | 5 items: The Mary Tyler Moore Show, Julia, That Girl, The Bill Cosby Show, Here's Lucy | HTTP 200; 0 items: none |
| Yaw / artist | 5 items: Balla et ses Balladins, Bembeya Jazz National, Orchestra Super Mazembe, Rail Band, Sir Victor Uwaifo | HTTP 200; 5 items: Captain Yaba, Oscar Sulley & The Uhuru Dance Band, King Ayisoba, Bokoor Band, Atongo Zimba |
| Yaw / book | 5 items: Tribute to Freud: Writing on the Wall and Advent, Letter from the Birmingham Jail, Beyond a Boundary, Dictionnaire Liturgique Historique Et Theorique De Plainchant Et De Musique D'eglise, Pimp: The Story of My Life | HTTP 200; 5 items: Tribute to Freud: Writing on the Wall and Advent, Letter from the Birmingham Jail, Beyond a Boundary, Dictionnaire Liturgique Historique Et Theorique De Plainchant Et De Musique D'eglise, Pimp: The Story of My Life |
| Carmen / movie | 5 items: Lady Sings the Blues, Your Cheatin' Heart, Sunrise at Campobello, The Way We Were, St. Louis Blues | HTTP 200; 4 items: Lucia, Memories of Underdevelopment, Death of a Bureaucrat, I Am Cuba |
| Carmen / tv_show | 5 items: It Takes a Thief, The Green Hornet, Julia, Longstreet, Dan August | HTTP 200; 0 items: none |
| Carmen / artist | 5 items: Cheo Feliciano, Andy Montañez, Sonora Carruseles, Oscar D'León, Fruko y sus Tesos | HTTP 200; 5 items: Orquesta Aragón, Willy Chirino, La Sonora Matancera, Roberto Torres, Los Van Van |
| Carmen / book | 5 items: Dune (Dune, #1), The Bell Jar, The Outsiders, One hundred years of solitude, Slaughterhouse-Five | HTTP 200; 5 items: Dune (Dune, #1), The Bell Jar, The Outsiders, One hundred years of solitude, Slaughterhouse-Five |

Important observations:

- Country filtering changed Carmen’s film results from US films to four Cuban films, and returned no TV matches. Yaw’s Ghana film/TV requests returned empty lists. These are allowed empty results, not a reason to inject generic alternatives.
- Valid music tags changed Carmen’s results to Orquesta Aragón, Willy Chirino, La Sonora Matancera, Roberto Torres and Los Van Van. Yaw’s Ghana tag returned Captain Yaba, Oscar Sulley & The Uhuru Dance Band, King Ayisoba, Bokoor Band and Atongo Zimba. These are candidates, not approved era matches; the existing independent date gate must reject later work.
- Artist requests with `filter.start_year.max=1900` and `filter.release_year.max=1900` still returned the same modern artists. These parameters were accepted but did not constrain this endpoint’s results; they were not added to production as pretend hard filters.
- `filter.release_country` left artist and book results unchanged. It is now used only for film/TV, where a result change was established.
- The first music-tag probes accidentally used an empty `filter.tags` because Qloo returned `id`, not `tag_id`. Those records are retained transparently under `artist/region-tags`; only `artist/region-tags-validated` is evidence for the production behavior. The parser now accepts both formats, requires an exact name and the music domain, and caches the resolved IDs.

## Feedback loop — already proved; reused existing evidence

No new demonstration or feedback implementation was added. The existing regression test `saved review changes the next session, keeps distress excluded, and never confirms a shared story` exercises one fictional resident through the complete loop:

```text
Profile: Fictional, b.1945, Liverpool, United Kingdom
Session 1: prepare plan containing the named Test Artist (entity: anchor).
Review: record distress for anchor; record a shared garden story separately.
Persist: saveWrapUp writes resident-scoped feedback and observation memory.
Session 2: generate with the saved feedback and memories.
Assert: anchor is absent from the next plan.
Assert: memory_read trace includes anchor in excludedIds.
Assert: garden story remains reported, not confirmed biography.
Assert: saving an edited review does not duplicate memories.
Result: PASS (existing test).
```

The separate existing positive-memory test also checks that a previously engaging entity is sent to Qloo in `signal.interests.entities`. This is deterministic fixture-backed integration evidence, not a newly claimed live-Qloo feedback experiment. The full regression suite naturally reran these existing tests while validating the filter change.

## Changes and validation

- `lib/echoes/qloo.ts`: country constraints for screen media, artist regional-tag constraints, exact/domain-specific tag resolution supporting `id` and `tag_id`, and place-only location filtering.
- `lib/echoes/pipeline.ts`: resolve the regional tag once per profile, pass country/tags into discovery, and include them in the trace.
- Added three request-wiring regressions; retained the existing feedback tests.
- `npm test`: **100 passed, 0 failed**. See [the test run log](echoes-qloo-constraints-tests.log).
- TypeScript, targeted ESLint and whitespace checks passed.

Reproduce the provider check: `node scripts/probe-qloo-constraints.cjs`. It reuses successful recorded probes and retries failures; remove or rename the probe JSON if you intentionally want every probe fetched again.
