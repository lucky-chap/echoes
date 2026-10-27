# Qloo integration notes

Smoke-tested against `https://hackathon.api.qloo.com` on 2026-10-27 using `npm run qloo:smoke`. The script emits status and result counts only; it never logs the API key.

## Confirmed request behavior

`/search` and `/v2/insights` both returned HTTP 200 with valid JSON. The following Insights parameters were accepted by the hackathon host in independent probes: `filter.type`, `signal.interests.entities`, `signal.demographics.age`, `filter.release_year.min/max`, `filter.publication_year.min/max`, `filter.release_country`, `filter.location.query`, `bias.trends`, `filter.popularity.min`, `filter.exclude.tags`, `filter.exclude.entities`, `filter.content_rating`, and `filter.results.entities`.

`/v2/tags?filter.query=…` returned HTTP 200. Echoes calls that endpoint for each sensitivity and only forwards exact returned tag IDs to `filter.exclude.tags`; an uncertain word is never passed as an invented tag.

## Adaptations and limits

- `filter.release_country=US` legitimately returned zero candidates for the test seed. Echoes treats an empty domain as a graceful degradation, not evidence that a filter was ignored.
- `filter.results.entities` also returned zero for the deliberately mismatched probe. Group coverage preserves the resident's original verified result if narrow re-scoring returns nothing.
- Search, tags, and Insights coverage are not uniform for pre-1975 and non-US/UK material. Echoes does not substitute an LLM suggestion for a missing result: an unresolved or empty item is dropped, and the kit displays a transparent note.
- Qloo returns entity IDs and ranking. The era bounds are sent as category-appropriate Insights filters; the interface labels all displayed choices as Qloo-matched and never claims additional historical metadata that the response did not provide.
- Echoes now adds an independent hard gate after Qloo ranking: MusicBrainz release facts for artists and TMDB release/first-air dates for film and TV. Candidate books and places are withheld until a comparably independent date source is connected; no item without source/year evidence is shown.
