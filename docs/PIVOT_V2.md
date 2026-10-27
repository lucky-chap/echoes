# Echoes v2 pivot plan

## Audit

- Echoes is a Next.js 16 / React 19 app with a typed, server-only Qloo client, era-verification gate, rate-limited routes, and browser-local feedback.
- There is no database, authentication provider, or deployment-bound persistence configured. The existing Groq SDK is server-only and can be reused for tightly constrained prose.
- The current session kit has verified items and feedback, but no workspace, durable person/session history, intake conversation, live run-of-show, agent trace, or session note.

## Plan

1. Keep the stack and implement an explicit browser-persistent workspace store, addressed by a generated secret-link ID. It retains nicknames, entity IDs, sessions, feedback, traces, and drafts only in that browser. A delete-everything action clears it. This is durable across reloads but not cross-device/shared persistence; a real hosted multi-device workspace requires a configured database.
2. Add an Echoes agent orchestrator around the existing Qloo/era pipeline. Every tool action produces a structured trace. The pipeline remains the authority on items; prose tools receive only final verified data.
3. Add free-text intake extraction, with deterministic local extraction as a safe fallback when the LLM is unavailable, and make missing fields explicit.
4. Add a minimal-tap live session view, immediate local learning from taps, engagement/pleasure score, and a constrained staff-review session-note draft.
5. Update evaluation, copy, tests, and docs. Stop before next-session planning, contribution links, and trend charts (the stated cut line).

## Safety and copy

Echoes will describe activity support for connection and pleasant moments only. It will retain a persistent notice that it is not medical advice and that care teams should follow the person’s care plan. No clinical outcome or treatment claim will be introduced.
