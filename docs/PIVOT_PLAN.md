# Echoes pivot plan

## Audit

- **Stack:** Next.js 16.4 App Router, React 19, TypeScript, Tailwind 4, Zod, and Node's built-in test runner.
- **Deployment/setup:** standard `next build`/`next start`; secrets are already server-only environment variables. There is no database or authentication layer.
- **Reusable pieces:** the current server-side Qloo client establishes the required fixed host, timeouts, retries, request de-duplication, caching, and secret handling. The existing visual components and routes model a different product and are not reusable.

## Keep

- The current Next.js/TypeScript/Tailwind toolchain and deployment scripts.
- The `.env.example` convention and server-only `QLOO_API_KEY`.
- The proven Qloo host restriction and defensive request patterns, adapted into an Echoes-specific typed client.

## Retire from the product surface

- Replace the Worldlings home screen, metadata, README, and product-specific navigation.
- Leave the old Worldlings implementation in the repository during this deadline-driven pivot so existing tests and historical work are not destructively removed; it will no longer be reachable from the UI.

## Add

1. `lib/echoes`: typed Qloo client, era/coverage/session pipeline, safe feedback storage contract, demos, and evaluation helpers.
2. Server routes for kit generation, feedback persistence via browser-owned state, and evaluation; all rate limited and all Qloo access server-side.
3. A caregiver-facing intake, kit, feedback, printable about-me sheet, and `/eval` interface.
4. Live endpoint smoke coverage plus recorded findings, core unit tests, documentation, an MIT license, and Devpost draft.

## Constraints carried into implementation

- Qloo resolution is a hard gate: unresolved items never reach the kit.
- The app produces activity-support material only; it makes no clinical or treatment claims.
- Feedback lives in the caregiver's browser and contains only a nickname plus entity IDs/statuses; no sensitive personal data is sent to or stored by the application.
