# Echoes three-profile diagnosis and verification

Run date: 2026-10-29. Changes extend the existing pipeline and review/live views; no rebuild of the application.

## Inputs and evidence

The profiles use the requested names, birth years, places, favourites and avoid lists. Explicit test-fixture notes: Dorothy—choir singing and tea; Yaw—proverbs, radio dramas, and “Sit on his left”; Carmen—dancing and cooking. These notes are test inputs, not inferred biography.

The initial diagnostic used persisted provider responses. The verification reused those responses and made live requests for missing TV spans, singles and release-count evidence. The archives retain all per-seed normalized Qloo rows and metadata, decision traces, surviving-item provenance, and full HTTP JSON bodies for new Qloo requests. Cached responses are labelled as cached; no fresh HTTP body is fabricated.

- [Complete baseline results and trace](echoes-three-profile-baseline.json.gz).
- [Complete verified results, per-result decisions and trace](echoes-three-profile-verified.json.gz).
- Reproduce: `node scripts/diagnose-three-profiles.cjs /tmp/echoes-three.json` (requires configured provider credentials); add `--offline` to replay cached evidence.

## Initial diagnosis

| Profile | Observed problem | Regional result |
| --- | --- | --- |
| Dorothy | Earliest hymn release for Aretha; self-titled Elvis album; I Love Lucy resolved to a compilation film. | No Bembeya/Matancera candidates returned for her seeds. |
| Yaw | The Mary Tyler Moore Show and a book displaced regional music. | Bembeya Jazz National returned #2 for E.T. Mensah, scored 15.6, passed date checks, then stayed in alternatives. |
| Carmen | The Mod Squad in the plan; Speed Racer in alternatives. | La Sonora Matancera returned #1 for Beny Moré, scored 26.6, passed date checks, then stayed in alternatives. |

These were downstream selection failures, not simply poor Qloo ranks. The baseline had a mandatory screen slot, weak regional scoring, and no separate plausibility gate.

## Verified running orders

### Dorothy

| Item | Selected work / years | Source seed |
| --- | --- | --- |
| Aretha Franklin | (You Make Me Feel Like) A Natural Woman (1967) | Named favourite |
| I Love Lucy | I Love Lucy (1951–1957) | Named favourite |
| Elvis Presley | Blue Suede Shoes (1956) | Named favourite |
| A Separate Peace | A Separate Peace (1959) | I Love Lucy |

- Tell me how you like your tea, or we can sit quietly.
- Hum a few notes together if you like, or rest your voice.

All activities total 30 minutes. No two prompts share a template.

### Yaw

| Item | Selected work / years | Source seed |
| --- | --- | --- |
| E.T. Mensah | E.T. Mensah Is Back Again (1976) | Named favourite |
| Jim Reeves | According to My Heart (1956) | Named favourite |
| Bonanza | Bonanza (1959–1973) | Jim Reeves |
| Bembeya Jazz National | Bembeya Jazz (1968) | E.T. Mensah |

- Wo pɛ a, ka ɛbɛ bi a wopɛ; anaa yɛnnyae mma akyiri. / Share a favourite proverb if you like, or we can leave it for another time.
- Paw radio so anansesɛm anaa nnwom; anaa yɛntena komm. / Tell me whether you prefer a short radio story or music, or choose quiet.

All activities total 30 minutes. No two prompts share a template.

### Carmen

| Item | Selected work / years | Source seed |
| --- | --- | --- |
| Celia Cruz | Poco a poco (1958) | Named favourite |
| Beny Moré | La voz inimitable (1958) | Named favourite |
| Lady Sings the Blues | Lady Sings the Blues (1972) | Celia Cruz |
| La Sonora Matancera | Mi madre querida (1958) | Beny Moré |

- Puede hacer un pequeño paso de baile sentada, o descansar los pies.
- Puede nombrar un plato que le guste cocinar, o dejar la cocina para otro momento.

All activities total 30 minutes. No two prompts share a template.

## Implementation and validation

- Discoveries need provider evidence of origin/region/language, availability, or a genre shared with the producing seed. No evidence means held back. Cartoons are excluded from discovery alternatives.
- Region evidence now affects ranking before date budgets are consumed. Named favourites retain priority, with a relevant discovery promoted into the running order.
- Original singles outrank albums; self-titled works and compilations are excluded. MusicBrainz official release counts rank the bounded shortlist. Its release-count search index helps populate that shortlist for larger catalogues. Counts are a popularity proxy, not a claim of personal familiarity or a definitive chart ranking. Optional popularity lookups have a separate six-second deadline; independently verified dates survive a popularity outage.
- Avoid checks cover titles and content themes, including conservative funeral-hymn associations. Artist biographies are not used in prompts. Confirmation must match the current notes before those notes become activities.
- Books are conversation topics without playback links, including the review and live views. TV checks use the full airing span; the review displays that span.
- English, Spanish and Twi invitations are concrete and optional. Bilingual invitations retain a line break in both review and live views. Follow the thread names at most two presented items.
- Verification: 97 tests, TypeScript, targeted ESLint, three-profile acceptance assertions, and `npx next build --webpack`. The default Turbopack build was blocked by this environment’s local-port restriction; webpack completed successfully.

Release-count API semantics were checked against the [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API) and [search fields](https://musicbrainz.org/doc/MusicBrainz_API/Search).

## Baseline per-seed decisions

Each returned candidate appears below in provider order. The compressed archive retains full metadata. Audit-only rows were fetched for diagnostic completeness; they are not claimed as evaluated by the original production run.

### Dorothy

**Aretha Franklin → artist**

1. Etta James — Verified alternative; not selected for running order; producing seed: Aretha Franklin.
2. Gladys Knight & The Pips — Held back Gladys Knight & The Pips: date-check budget reached..
3. Stevie Wonder — Held back Stevie Wonder: date-check budget reached..
4. Marvin Gaye — Held back Marvin Gaye: date-check budget reached..
5. Ray Charles — Held back Ray Charles: date-check budget reached..

**Aretha Franklin → movie**

1. St. Louis Blues — St. Louis Blues: No unique title in TMDB; ambiguous remakes are not guessed..
2. West Side Story — West Side Story: No unique title in TMDB; ambiguous remakes are not guessed..
3. The Sound of Music — The Sound of Music: No unique title in TMDB; ambiguous remakes are not guessed..
4. Funny Girl — Held back Funny Girl: date-check budget reached..
5. Gypsy — Held back Gypsy: date-check budget reached..

**Aretha Franklin → tv_show**

1. General Hospital — General Hospital: No unique title in TMDB; ambiguous remakes are not guessed..
2. Days of Our Lives — Held back Days of Our Lives: date-check budget reached..
3. That Girl — Held back That Girl: date-check budget reached..
4. The Lucy Show — Held back The Lucy Show: date-check budget reached..
5. One Life to Live — Held back One Life to Live: date-check budget reached..

**Aretha Franklin → book**

1. Lord of the Flies — Verified alternative; not selected for running order; producing seed: Aretha Franklin.
2. One Flew Over the Cuckoo's Nest — Held back One Flew Over the Cuckoo's Nest: date-check budget reached..
3. The Bell Jar — Held back The Bell Jar: date-check budget reached..
4. Flowers for Algernon — Held back Flowers for Algernon: date-check budget reached..
5. Lolita — Held back Lolita: date-check budget reached..

**Elvis Presley → artist**

1. Roy Orbison — Held back Roy Orbison: date-check budget reached..
2. The Animals — Verified alternative; not selected for running order; producing seed: Elvis Presley.
3. Jerry Lee Lewis — Verified alternative; not selected for running order; producing seed: Elvis Presley.
4. Chuck Berry — Verified alternative; not selected for running order; producing seed: Elvis Presley.
5. The Mamas & the Papas — Held back The Mamas & the Papas: date-check budget reached..

**Elvis Presley → movie**

1. Gypsy — Held back Gypsy: date-check budget reached..
2. Belarmino — Held back Belarmino: date-check budget reached..
3. Tender Is the Night — Held back Tender Is the Night: date-check budget reached..
4. Guess Who's Coming to Dinner — Held back Guess Who's Coming to Dinner: date-check budget reached..
5. The Agony and the Ecstasy — Held back The Agony and the Ecstasy: date-check budget reached..

**Elvis Presley → tv_show**

1. Family Affair — Held back Family Affair: date-check budget reached..
2. The Monkees — Running order; producing seed: Elvis Presley.
3. The Mod Squad — Verified alternative; not selected for running order; producing seed: Elvis Presley.
4. Gilligan's Island — Held back Gilligan's Island: date-check budget reached..
5. The Addams Family — Held back The Addams Family: date-check budget reached..

**Elvis Presley → book**

1. The Lords and the New Creatures — Running order; producing seed: Elvis Presley.
2. The Beatles Illustrated Lyrics — Verified alternative; not selected for running order; producing seed: Elvis Presley.
3. The Mandelbaum Gate — Held back The Mandelbaum Gate: date-check budget reached..
4. In His Own Write — Held back In His Own Write: date-check budget reached..
5. Howl, Kaddish and Other Poems — Held back Howl, Kaddish and Other Poems: date-check budget reached..

**I Love Lucy → artist**

1. Blondie — Held back Blondie: date-check budget reached..
2. The Pretenders — Held back The Pretenders: date-check budget reached..
3. Devo — Held back Devo: date-check budget reached..
4. Joan Jett and the Blackhearts — Held back Joan Jett and the Blackhearts: date-check budget reached..
5. The Boomtown Rats — Held back The Boomtown Rats: date-check budget reached..

**I Love Lucy → movie**

1. Seven Brides for Seven Brothers — Held back Seven Brides for Seven Brothers: date-check budget reached..
2. Summer Magic — Held back Summer Magic: date-check budget reached..
3. Forever, Darling — Held back Forever, Darling: date-check budget reached..
4. Move Over, Darling — Held back Move Over, Darling: date-check budget reached..
5. Li'l Abner — Held back Li'l Abner: date-check budget reached..

**I Love Lucy → tv_show**

1. That Girl — Held back That Girl: date-check budget reached..
2. The Flintstones — Held back The Flintstones: date-check budget reached..
3. The Brady Bunch — Held back The Brady Bunch: date-check budget reached..
4. Dad's Army — Held back Dad's Army: date-check budget reached..
5. The Lucy Show — Held back The Lucy Show: date-check budget reached..

**I Love Lucy → book**

1. Lord of the Flies — Verified alternative; not selected for running order; producing seed: Aretha Franklin.
2. The Bell Jar — Held back The Bell Jar: date-check budget reached..
3. A Separate Peace — Held back A Separate Peace: date-check budget reached..
4. Night — Held back Night: date-check budget reached..
5. One Flew Over the Cuckoo's Nest — Held back One Flew Over the Cuckoo's Nest: date-check budget reached..

### Yaw

**E.T. Mensah → artist**

1. Balla et ses Balladins — Balla et ses Balladins: Independent dates were found, but none falls in the requested era..
2. Bembeya Jazz National — Verified alternative; not selected for running order; producing seed: E.T. Mensah.
3. Orchestra Super Mazembe — Held back Orchestra Super Mazembe: date-check budget reached..
4. Rail Band — Held back Rail Band: date-check budget reached..
5. Sir Victor Uwaifo — Sir Victor Uwaifo: No matching MusicBrainz artist or alias was found..

**E.T. Mensah → movie**

1. The Diary of Anne Frank — Held back The Diary of Anne Frank: date-check budget reached..
2. The Quiet American — Held back The Quiet American: date-check budget reached..
3. Cairo 30 — Held back Cairo 30: date-check budget reached..
4. The Shop on Main Street — Held back The Shop on Main Street: date-check budget reached..
5. To Die in Madrid — Held back To Die in Madrid: date-check budget reached..

**E.T. Mensah → tv_show**

1. The Mary Tyler Moore Show — Running order; producing seed: E.T. Mensah.
2. That Girl — Verified alternative; not selected for running order; producing seed: E.T. Mensah.
3. The Odd Couple — Held back The Odd Couple: date-check budget reached..
4. Car 54, Where Are You? — Held back Car 54, Where Are You?: date-check budget reached..
5. Hazel — Held back Hazel: date-check budget reached..

**E.T. Mensah → book**

1. Tribute to Freud: Writing on the Wall and Advent — Held back Tribute to Freud: Writing on the Wall and Advent: date-check budget reached..
2. Letter from the Birmingham Jail — Held back Letter from the Birmingham Jail: date-check budget reached..
3. Beyond a Boundary — Held back Beyond a Boundary: date-check budget reached..
4. Pimp: The Story of My Life — Held back Pimp: The Story of My Life: date-check budget reached..
5. The Vulture — Held back The Vulture: date-check budget reached..

**Jim Reeves → artist**

1. Sonny James — Verified alternative; not selected for running order; producing seed: Jim Reeves.
2. Tammy Wynette — Held back Tammy Wynette: date-check budget reached..
3. Eddy Arnold — Held back Eddy Arnold: date-check budget reached..
4. Lynn Anderson — Held back Lynn Anderson: date-check budget reached..
5. Ferlin Husky — Held back Ferlin Husky: date-check budget reached..

**Jim Reeves → movie**

1. Funny Girl — Funny Girl: No unique title in TMDB; ambiguous remakes are not guessed..
2. Guess Who's Coming to Dinner — Verified alternative; not selected for running order; producing seed: Jim Reeves.
3. The Prime of Miss Jean Brodie — Verified alternative; not selected for running order; producing seed: Jim Reeves.
4. Hawaii — Hawaii: No unique title in TMDB; ambiguous remakes are not guessed..
5. Gypsy — Held back Gypsy: date-check budget reached..

**Jim Reeves → tv_show**

1. Bonanza — Verified alternative; not selected for running order; producing seed: Jim Reeves.
2. The Big Valley — Held back The Big Valley: date-check budget reached..
3. Wagon Train — Held back Wagon Train: date-check budget reached..
4. The Rifleman — Held back The Rifleman: date-check budget reached..
5. The Virginian — Held back The Virginian: date-check budget reached..

**Jim Reeves → book**

1. A Moveable Feast — Running order; producing seed: Jim Reeves.
2. The Doors of Perception & Heaven and Hell — Verified alternative; not selected for running order; producing seed: Jim Reeves.
3. The Electric Kool-Aid Acid Test — Verified alternative; not selected for running order; producing seed: Jim Reeves.
4. One Flew Over the Cuckoo's Nest — Held back One Flew Over the Cuckoo's Nest: date-check budget reached..
5. Post Office — Held back Post Office: date-check budget reached..

### Carmen

**Celia Cruz → artist**

1. Cheo Feliciano — Held back Cheo Feliciano: date-check budget reached..
2. Andy Montañez — Held back Andy Montañez: date-check budget reached..
3. Sonora Carruseles — Sonora Carruseles: Independent dates were found, but none falls in the requested era..
4. Oscar D'León — Oscar D'León: Independent dates were found, but none falls in the requested era..
5. Fruko y sus Tesos — Verified alternative; not selected for running order; producing seed: Celia Cruz.

**Celia Cruz → movie**

1. Lady Sings the Blues — Verified alternative; not selected for running order; producing seed: Celia Cruz.
2. The Way We Were — Excluded The Way We Were: saved distress or a supplied topic-to-avoid matched provider metadata..
3. St. Louis Blues — Held back St. Louis Blues: date-check budget reached..
4. Woodstock — Held back Woodstock: date-check budget reached..
5. Sweet Bird of Youth — Excluded Sweet Bird of Youth: saved distress or a supplied topic-to-avoid matched provider metadata..

**Celia Cruz → tv_show**

1. The Green Hornet — Held back The Green Hornet: date-check budget reached..
2. Kojak — Held back Kojak: date-check budget reached..
3. The Mod Squad — Running order; producing seed: Celia Cruz.
4. The Young and the Restless — Held back The Young and the Restless: date-check budget reached..
5. Route 66 — Held back Route 66: date-check budget reached..

**Celia Cruz → book**

1. Dune (Dune, #1) — Verified alternative; not selected for running order; producing seed: Celia Cruz.
2. The Bell Jar — Verified alternative; not selected for running order; producing seed: Celia Cruz.
3. The Outsiders — Verified alternative; not selected for running order; producing seed: Celia Cruz.
4. One hundred years of solitude — Held back One hundred years of solitude: date-check budget reached..
5. Slaughterhouse-Five — Held back Slaughterhouse-Five: date-check budget reached..

**Beny Moré → artist**

1. La Sonora Matancera — Verified alternative; not selected for running order; producing seed: Beny Moré.
2. Trio Matamoros — Held back Trio Matamoros: date-check budget reached..
3. Orquesta Aragón — Held back Orquesta Aragón: date-check budget reached..
4. Afro-Cuban Jazz Project — Held back Afro-Cuban Jazz Project: date-check budget reached..
5. Los Guaracheros de Oriente — Held back Los Guaracheros de Oriente: date-check budget reached..

**Beny Moré → movie**

1. Bit of Fear — Held back Bit of Fear: date-check budget reached..
2. Imberaturiyyat Mim — Held back Imberaturiyyat Mim: date-check budget reached..
3. Too Young for Love — Held back Too Young for Love: date-check budget reached..
4. Fi Baytena Ragul — Held back Fi Baytena Ragul: date-check budget reached..
5. The Beginning and the End — Held back The Beginning and the End: date-check budget reached..

**Beny Moré → tv_show**

1. Speed Racer — Verified alternative; not selected for running order; producing seed: Beny Moré.
2. Wacky Races — Wacky Races: No unique title in TMDB; ambiguous remakes are not guessed..
3. The Green Hornet — Held back The Green Hornet: date-check budget reached..
4. Jonny Quest — Held back Jonny Quest: date-check budget reached..
5. Great Performances — Verified alternative; not selected for running order; producing seed: Beny Moré.

**Beny Moré → book**

1. Dune (Dune, #1) — Verified alternative; not selected for running order; producing seed: Celia Cruz.
2. The Bell Jar — Verified alternative; not selected for running order; producing seed: Celia Cruz.
3. The Outsiders — Verified alternative; not selected for running order; producing seed: Celia Cruz.
4. One hundred years of solitude — Held back One hundred years of solitude: date-check budget reached..
5. Slaughterhouse-Five — Held back Slaughterhouse-Five: date-check budget reached..

**Gloria Estefan → artist**

1. Jon Secada — Held back Jon Secada: date-check budget reached..
2. Julio Iglesias — Held back Julio Iglesias: date-check budget reached..
3. Chayanne — Held back Chayanne: date-check budget reached..
4. Ricky Martin — Held back Ricky Martin: date-check budget reached..
5. Marc Anthony — Held back Marc Anthony: date-check budget reached..

**Gloria Estefan → movie**

1. Chastity — Held back Chastity: date-check budget reached..
2. On a Clear Day You Can See Forever — On a Clear Day You Can See Forever: No unique title in TMDB; ambiguous remakes are not guessed..
3. A Touch of Class — Held back A Touch of Class: date-check budget reached..
4. Lady Sings the Blues — Verified alternative; not selected for running order; producing seed: Celia Cruz.
5. Romeo and Juliet — Held back Romeo and Juliet: date-check budget reached..

**Gloria Estefan → tv_show**

1. The Mary Tyler Moore Show — Held back The Mary Tyler Moore Show: date-check budget reached..
2. That Girl — Held back That Girl: date-check budget reached..
3. Bewitched — Held back Bewitched: date-check budget reached..
4. The Lucy Show — Held back The Lucy Show: date-check budget reached..
5. The Brady Bunch — Held back The Brady Bunch: date-check budget reached..

**Gloria Estefan → book**

1. Dune (Dune, #1) — Verified alternative; not selected for running order; producing seed: Celia Cruz.
2. The Bell Jar — Verified alternative; not selected for running order; producing seed: Celia Cruz.
3. The Outsiders — Verified alternative; not selected for running order; producing seed: Celia Cruz.
4. One hundred years of solitude — Held back One hundred years of solitude: date-check budget reached..
5. Slaughterhouse-Five — Held back Slaughterhouse-Five: date-check budget reached..

