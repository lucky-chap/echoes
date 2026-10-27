# Town Director design

## Step 0 findings

Speech stops for two independent guards that become a poor default for a
long-running town. `sessionLimit()` clamps every session to ten Groq calls, and
the scene route returns a silent `quietScene()` after that limit or a
daily/minute quota rejection. Quiet scenes still advance activities, but have
no speech. Client autoplay is also limited to a three-scene `checkpoint`, so
the simulation then remains finished until someone presses Next Event. A 429
returns a waiting bundle with a retry timestamp; other skipped calls finish as
silent fallback scenes.

## Director and day plans

The deterministic local director starts every day with a square assembly,
derives bounded commitments from existing plans, verified Qloo discoveries and
resident needs, and always selects the first due commitment. A commitment
contains venue, time, roster, optional verified entity and outcome. The engine
records attendance/outcome at that venue. Morning precedes all non-morning
work; an evening square wrap-up seeds the next agenda. Groq only voices an
already scheduled scene and cannot mutate a commitment.

## Budget

An injectable-clock token-bucket module allows six requests/minute per
resident, a seven-request shared reserve, and at most 25 total requests/minute.
The route charges a scene to its lead and rotates to another participant when
needed; if all are exhausted it returns a silent moving scene. A 429 creates a
retry-after cooldown without retrying. The old ten-call session cap becomes
configurable and defaults beyond a normal simulated day; daily ceilings remain
independent and configurable.
