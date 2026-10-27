# Dialogue reliability

The current prompt repeats character histories, memories, social summaries and
cultural metadata. Keep one compact evidence list, a short deduplicated history
for repetition avoidance, the exact attendance plan, and relevant relationships.
The full bounded world still feeds the server validators; shortening a prompt
must never shorten validation history. One request still returns a whole scene.

During playback, project the deterministic engine to scene completion on a
clone. Prefetch one next scene for that exact validated snapshot. Compare the
complete snapshot at consumption, not only the scene counter. Reset, context
changes and unmount invalidate/abort the slot. Paused or hidden clients do not
start speculative requests. An in-flight prefetch is reused rather than issuing
a duplicate foreground call. Projection never commits memories to the UI.

Groq remains primary. An explicitly enabled Cerebras provider uses the same
schema, normalization, grounding, attribution and repetition checks. Both share
the application request budget and session ceiling but have separate durable
provider request/token ceilings and cooldowns. At most two provider attempts
per scene: with backup enabled, one primary and one backup; otherwise the
existing bounded primary retry. Provider 429s respect Retry-After without
retrying that provider. Diagnostics identify the actual source and failover.

Paid Groq operation requires explicit configuration. No credentials, billing
changes, spending cap changes, or increased production ceilings are applied
automatically. Prefetch calls are real usage and count even if later discarded.
