# Belong — Qloo feasibility report

Generated: 2026-10-25T14:14:43.628154+00:00

## Executive summary

This report separates observed response data in the JSON artifacts from product assumptions. Qloo affinity is not represented as a satisfaction probability or a universally comparable neighborhood score.

## Connectivity and entity resolution

Calls recorded: 14. Transport/no-response calls: 0. Harness errors: 0.

- reflective_creative: 3 named signals resolved; 0 unsupported/ambiguous preferences.
- social_explorer: 2 named signals resolved; 1 unsupported/ambiguous preferences.
- curious_minimalist: 1 named signals resolved; 2 unsupported/ambiguous preferences.

## Neighborhood coverage

| Requested locality | Strict HTTP | Venues | Coordinates missing | Resolution caveat |
|---|---:|---:|---:|---|
| Williamsburg, Brooklyn, New York, USA | 200 | 10 | 10 | No query.locality.signal returned; cannot verify neighborhood resolution. |

## Limits and decision

- `filter.location.query` is fuzzy; strict `filter.location.radius=0` is used before any expanded boundary. No city-wide substitution is made.
- Explainability and raw affinity are preserved in `belong_results.json` when returned; absent fields remain absent.
- Negative preference is not modeled as negative affinity. Any future filtering must be documented and transparent.
- A responsible neighborhood comparison needs shared candidates/descriptive evidence; this harness does not claim Qloo provides a global location-fit score.

## Recommendation

**CONDITIONAL GO** only if the live coverage, persona differentiation, and explainability records in this run are adequate for the target neighborhoods. If blocked or thin/ambiguous, treat this as **NO-GO for neighborhood ranking** and test a city-level discovery MVP instead.
