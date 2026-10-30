# Echoes demo verification log

Run date: 2026-10-29.

Follow-up rerun: 2026-10-29, after unknown-count handling, named-favourite cautions, and cached ongoing-series migration.

Profiles: Dorothy (1944), Margaret (1946), and Robert (1950), using the unchanged demo notes and preferences in `lib/echoes/demo-profiles.ts`.

## Running orders

- Dorothy: Aretha Franklin — *(You Make Me Feel Like) A Natural Woman*; I Love Lucy; Elvis Presley — *Blue Suede Shoes*; Jerry Lee Lewis — *Great Balls of Fire*.
- Margaret: The Beatles — *Love Me Do*; Dusty Springfield — *Stay Awhile*; Coronation Street; The Who — *My Generation*.
- Robert: Stevie Wonder — *Fingertips*; Carole King — *It's Too Late*; The Dick Van Dyke Show; The Isley Brothers — *Twist and Shout*.

Margaret's dancing note is attached to The Beatles music activity. Her Sunday lunch note is a separate, specific invitation. Robert has separate radio-drama and cooking invitations. Dorothy's choir note is attached to Aretha Franklin, and afternoon tea is a separate invitation.

The Mary Tyler Moore Show was held back because Qloo supplied an `election` keyword and Robert's caregiver avoid list includes politics. Its date-check row records the matched topic as `politics` and offers **Include anyway**.

## Track ranking evidence

### Dusty Springfield

Displayed choice: artist-level Dusty Springfield invitation. The internal provisional leader is *Stay Awhile* (1964), but it is not presented as a confidently selected single.

- Qloo notable-song match: unavailable.
- Official MusicBrainz release count: 2.
- Widely released signal: false.
- Tie-break: 1964, ahead of later candidates with the same count.
- Trace status: `popularity coverage incomplete`.

The other count-2 candidates checked were *I Just Don't Know What to Do With Myself* (1964) and *Some of Your Lovin'* (1965). The leading MusicBrainz release-group title is *Stay Awhile / Something Special*.

*I Only Want to Be With You / Once Upon a Time* is inside the bounded count set and has one official release. *You Don't Have to Say You Love Me* is outside the approximately 12-candidate live-fetch cap; its count is therefore `unknown` in the ranking trace rather than zero. A direct diagnostic request found two official releases, confirming that the prior absence was caused by the candidate cap rather than title matching or an unavailable MusicBrainz release group.

ListenBrainz documents an artist-MBID top-recordings endpoint, but the live endpoint returned HTTP 401 and requires an authentication token. It was not added as a ranking dependency.

### The Beatles

Displayed choice: artist-level Beatles invitation because Qloo supplied no notable-song data and the bounded popularity coverage is incomplete.

The internal comparison was:

| Release group | Official releases | Widely released | Year |
| --- | ---: | --- | ---: |
| Love Me Do / P.S. I Love You | 33 | yes | 1962 |
| Can't Buy Me Love / You Can't Do That | 27 | yes | 1964 |
| She Loves You / I'll Get You | 23 | yes | 1963 |

With no Qloo notable match for any of the three, *Love Me Do* leads on official release count.

### The Who

Selected: *My Generation* (1965).

- Qloo notable-song match: true.
- Official MusicBrainz release count: 11.
- Widely released signal: true.
- Popularity coverage: complete for the bounded candidate set.

*I Can't Explain* had 12 official releases and a widely released signal, but no Qloo notable-song match, so it ranked below *My Generation*. This demonstrates the required order: Qloo notable match, official release count, widely released signal, then earliest year.

## Verification

- Unit and integration tests: 112 passed.
- TypeScript: passed.
- Next.js production build with webpack: passed.
- The default Turbopack build could not bind an internal local port in the sandbox; the webpack build completed successfully.

The complete machine-readable run contains raw Qloo results by producing seed and domain, every filtering decision, surviving-item provenance, plan output, and ranking candidate arrays. It is written by `scripts/diagnose-three-profiles.cjs` to the path supplied on the command line.

## Final UI checks

- Visible swaps: Dorothy's Jerry Lee Lewis card offers Chuck Berry, Etta James, and Stevie Wonder. Every other running-order card shows no swap menu because fewer than two unused, compatible options survive.
- The Dick Van Dyke Show label reads: `Because you chose The Mary Tyler Moore Show, Qloo suggested this TV show. Personal familiarity is unconfirmed.`
- Follow the thread pairs: Jerry Lee Lewis with Elvis Presley; The Who with The Beatles; The Isley Brothers with Stevie Wonder.
- Coronation Street renders as `1960–present`.
- Each named favourite has one caregiver-supplied favourite explanation.
- Margaret's cooking invitation mentions Sunday lunch; Robert's asks for a favourite dish. Their normalized prompt templates differ.
