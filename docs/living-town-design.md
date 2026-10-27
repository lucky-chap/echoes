# Living town design

The planner now treats a gathering as a persisted social commitment rather
than a scene-shaped exception.  It first honors due accepted invitations, then
uses deterministic need scores (low social reserves, relationship decay,
unresolved discoveries, events, and a seeded variation) to create invitations
at the venue that best fits the shared reason.  Invitations can be accepted,
declined, or accepted late; cancelled and completed outcomes remain bounded
world memories.

The engine uses the plan's venue as its authoritative attendance boundary.
Residents walk there before dialogue and an absent or late resident cannot
speak.  It records the actual venue and outcome, while normal solo destination
activities continue unchanged.  This keeps movement and state mutation local;
Groq still only supplies validated dialogue.

Scheduling is intentionally local and deterministic.  Social reserves recover
slowly between scenes, relationships decay without contact, and no API result
is invented.  Ambient movement/activity can therefore advance even when there
is no dialogue.  The server quota ceiling is reduced to 25 requests/minute
(with a conservative default below that), and a 429 preserves a waiting
meeting while the town remains animated; it never creates fallback dialogue.
