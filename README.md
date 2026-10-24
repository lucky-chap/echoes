# Worldlings

An original pixel-art town built with Next.js App Router, TypeScript, Tailwind CSS, Canvas, React overlays, and native Web Audio. No downloaded artwork, audio assets, API keys, or extra runtime dependencies are needed.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Production: `npm run build` then `npm start`. If your sandbox restricts Turbopack worker ports, use `npm run build -- --webpack`.

## An afternoon in Littlehaven

Select Mia, Kai, or Luna to highlight their sprite. **Start Event** runs the complete state machine: idle → gathering → proposing → deliberating → deciding → traveling → completing an activity → finished. Each resident has a personality, goal, cultural interests, and weighted taste profile.

The residents discuss their own proposals, negotiate a shared destination, walk along the town's paths, and react to their completed activity. The original town and characters are retained; the former Moonbeam building is now labeled **The Museum**, alongside **The Daily Cup** and **The Green Room**.

- **Change the situation** before or during an event: a gentle afternoon, rain, or a surprise live performance. All scores are recomputed. During an event, residents return from their current positions to the square, discuss the new context, and make a new decision. Previous conversations and decision entries remain available.
- **Pause/resume**, **reset**, **replay**, and **resident names** work independently of audio settings. Replay starts a fresh run using the selected situation. Reset returns to idle.
- The current speaker has a speech bubble, a matching conversation entry, and a unique procedural talking sound. Expand conversation history to read previous messages.
- The decision log includes cultural profiles, goals, all destination scores and reasons, proposals, the compromise, context changes, arrivals, and completion.

## Transparent decisions, mock data

The `TasteProvider` interface accepts profiles, destinations, and context and asynchronously returns scored recommendations with explicit provenance. Only `mockTasteProvider` is implemented. No Qloo API or LLM is contacted, and no mock result is attributed to Qloo.

For each resident, the mock provider computes a weighted taste match, then applies documented context adjustments. Group satisfaction is **65% average score + 35% minimum individual score**, so the least-satisfied person matters. Ties prefer the higher minimum, then a stable destination ID. The winner is calculated from the supplied scores, never fixed in UI or simulation code.

The current profiles produce different outcomes for sunny, rainy, and live-performance contexts, but a situation change does not require a different winner. Contextual dialogue templates refer to the actual proposals, scores, situation, and selected activity; there is no permanently fixed dialogue sequence. This is a deterministic local simulation, not generative AI.

A future Qloo adapter should call a server-side route, keep keys on the server, validate response completeness and scores, map results to the venue model, and set `LIVE Qloo` provenance only for real responses. Provider failures leave the simulation recoverable. An LLM is not required.

## Original procedural audio

Music starts only after a user interaction. The soundtrack is an original eight-bar melody at 76 BPM with quiet triangle plucks, sine harmonies, and a light accompaniment. One look-ahead scheduler uses the AudioContext clock; smooth gain envelopes and a shared compressor limit clicks and peaks.

Mia has mellow, warm sine chirps; Kai has lower, faster triangle chirps; Luna has slower, airy sine chirps with a faint bell harmonic. Chatter is throttled to short 65–95 ms notes, stops when the speaker changes or playback pauses, and is independent of the simulation clock.

Music and effects have separate toggles and volume sliders. Effects include soft interaction, decision, and infrequent bird sounds. Hidden tabs suspend audio and simulation, and resume the active line on return. Muted settings survive replay/reset for the current page session. Unmounting stops timers, disconnects nodes, and closes the context. The game works if Web Audio is unavailable.

## Modules

- `lib/world/profiles.ts`: residents, taste profiles, situations, destinations.
- `lib/world/taste-provider.ts`: replaceable asynchronous provider and deterministic mock scores.
- `lib/world/decision.ts`: validation, proposals, and collective scoring.
- `lib/world/dialogue.ts`: context-sensitive proposals, negotiation, and reactions.
- `lib/world/simulation.ts`: pure state machine, history, phase transitions, and decision log.
- `lib/world/movement.ts`: routes and integer positions along existing town paths.
- `lib/world/audio/engine.ts`: music scheduling, output buses, lifecycle, and effects.
- `lib/world/audio/voices.ts`: distinct resident sound identities.
- `lib/world/art.ts`: original pixel renderer at 480 × 320 logical resolution, nearest-neighbor display.
- `components/world/use-world.ts`: playback, provider requests, visibility, and audio coordination.
- `components/world/worldlings.tsx`: existing town layout and interactive React overlays.

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
```

The Node tests use the existing TypeScript compiler and no additional test dependency. They cover computed winners, malformed provider data, every phase and arrival, continuous vs. large ticks, changes during every phase, context-driven dialogue, replay, pixel rendering, and audio scheduler/mute/visibility/disposal behavior. The test command uses Node's `--test-isolation=none`; verified with Node 26.1.0.

An optional end-to-end scenario is saved in `tests/browser-check.cjs`. It uses an already-installed Playwright and Chromium, without adding them to the application dependencies. With a local server running, set `WORLDLINGS_PLAYWRIGHT_PATH` to the installed Playwright package and `WORLDLINGS_BROWSER_PATH` to the Chromium executable, then run `node tests/browser-check.cjs`. `WORLDLINGS_URL` defaults to `http://localhost:3000`. The scenario checks every outcome, pause/replay, audio controls, mobile layout, and browser errors; screenshots go to `/tmp`.
