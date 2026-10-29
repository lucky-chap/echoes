# Western profile follow-up — 29 October 2026

## Evidence and fixes

| Reported result | Diagnosis | Change |
| --- | --- | --- |
| Margaret: The Beatles, “The Girl I Love” | Cached Qloo external MusicBrainz ID `8d3431db-bc83-4dc2-93b8-0e46e31d09f7` identifies a different group with the same name: a Philadelphia doo-wop group. | Resolve artist identity independently before using its catalogue. A unique exact match or uniquely dominant exact search result is required; unresolved homonyms stay held back. Versioned date cache invalidated so the old attribution cannot replay. |
| Dorothy: a colour invitation for I Love Lucy | Generic screen template assumed colour. | Neutral invitation to watch the people. Generated screen prompts that assume colour are rejected. |
| Robert: humming despite not wanting to sing | Fallback and generated prompts did not enforce confirmed singing dislikes. | Enforce the preference for generated, cached, fallback and replacement invitations, including singing activities derived from notes. Pass the real resident to replacement planning. |
| No note activities or logistics in the pasted plans | Only preferences confirmed against the current notes are used. The pasted output does not establish whether these were confirmed. | Show an explicit unconfirmed-notes notice and open the review fields. Trace confirmation accurately. Do not silently confirm preferences. |
| Many date checks deferred | Large artist catalogues could consume up to five browse pages before singles and popularity checks, within one shared session deadline. | Read one catalogue page plus a singles page for partial catalogues; limit each initial date lookup to 15 seconds. Unfinished items remain held back and retryable. This reduces starvation; it does not guarantee every provider check completes. |
| Robert: “few dated items” despite several verified music items | Generic coverage warning depended on diversity of domains. | Show this warning only when fewer than two in-window checks exist and no checks remain pending. Regional discovery coverage remains a separate check. |
| “No film or TV match passed checks” with pending screen candidates | Message ignored pending checks. | Explain that screen date checks remain incomplete. Remove stale screen warning after a successful retry adds screen media. |
| The Mary Tyler Moore Show excluded | Cached Qloo keywords/tags contain `election`, which matches Robert’s politics avoidance. | Preserve the exclusion. Distinguish a provider-metadata avoidance match from a saved distress response instead of combining both explanations. |

## Live identity and track verification

Direct MusicBrainz search returned:

- `b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d`: The Beatles — UK rock band, “The Fab Four”; score 100, country GB.
- `8d3431db-bc83-4dc2-93b8-0e46e31d09f7`: The Beatles — 1960s Philadelphia doo-wop group; score 56.
- Other same-name results scored below the UK band. The linked ID was not allowed to override this identity check.

Running the corrected `lookupYearFact` with Margaret’s 1946 birth year and the incorrect Qloo external ID produced:

```json
{
  "status": "verified",
  "title": "Can’t Buy Me Love",
  "year": 1964,
  "workType": "track",
  "releaseCount": 27,
  "source": "MusicBrainz",
  "cached": false,
  "url": "https://musicbrainz.org/release-group/2c63c3db-d39d-31f5-9cb2-0157d81be6f6"
}
```

Popularity ranking compares the checked catalogue and official release counts; it is not a claim to have exhaustively ranked every recording. Qloo discovery itself was not rerun for all three profiles in this follow-up.

## Validation and retesting

- `npm test`: 104 passed, 0 failed.
- `npm run typecheck`: passed.
- ESLint on changed implementation files: passed.
- `git diff --check`: passed.

Regression tests cover wrong external IDs and same-name artists, original single ranking, no-singing initial/replacement prompts, neutral screen prompts, coverage wording, and two confirmed note activities plus logistics for Dorothy, Margaret and Robert. The three-profile note checks use provider fixtures, not live Qloo results.

Generate fresh plans to use these changes. Existing saved plans retain their content. For each profile, review the extracted preferences (or enter the values from `echoes-western-test-profiles.md`) and confirm them after the last notes edit. Expected note activities: Dorothy — singing and tea; Margaret — dancing and cooking; Robert — radio dramas and cooking. Robert’s confirmed dislikes must include singing.

The confirmation state of the user's original pasted plans remains unverified.
