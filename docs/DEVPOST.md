# Echoes — Devpost draft

## Inspiration

Familiar cultural touchstones can open gentle, human moments. Caregivers and activity staff need a quick way to prepare those moments without pretending a recommendation is a fact.

## What it does

Echoes creates a 30-minute activity-support session kit from a first name or nickname, birth year, childhood location, language, a few loved things, and optional topics to avoid. It offers dated music, film/TV, and books from the person's ages 10–25, conversation starters, a printable About Me sheet, and feedback controls.

## How we built it

Next.js 16 powers a server-only Qloo integration. `/search` resolves every input name to an entity ID. `/v2/insights` expands and ranks only with verified IDs, familiarity, age, location, era, content, and exclusion filters. `/v2/tags` resolves sensitivities before they are used as exclusions. The browser stores only entity-ID feedback so sparked results become future seeds and distressed results are excluded.

## Qloo's role

Qloo is the scoring, filtering, expansion, and learning engine. It is a hard gate: no unresolved item renders. A second hard gate independently checks shown artists with MusicBrainz and film/TV with TMDB, retaining only a dated work in the reminiscence window. Prose is intentionally bounded to verified names and caregiver-safe activity support; Echoes makes no clinical or treatment claims.

## Challenges

Coverage varies for older and non-US cultural items. We chose honest degradation over invented substitutions: show the verified domains that remain and clearly say when a domain is empty.

## What’s next

Connect browser-owned feedback to a consented caregiver workspace, add more region-specific cultural sources as Qloo seeds, and test the interface alongside activity staff.
