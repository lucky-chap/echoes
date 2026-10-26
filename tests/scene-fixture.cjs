// Test-only authored scenes. Production fallback never imports or plays these.
function sceneFixture({ world, plan }) {
  const [a, b] = plan.initialParticipants
  const third = plan.participants.find((id) => id !== a && id !== b)
  const opening = {
    mia: "The fountain looks like a crown from here. Would you sit beside it?",
    kai: "The fountain looks like a drum to me. Shall we sit beside it?",
    luna: "The fountain has an interesting outline. I want to draw it from here.",
  }
  const answer = {
    mia: "Beside it, yes. Close enough to watch the water, far enough to stay dry.",
    kai: "Beside it sounds good. I can sit still long enough to watch the water.",
    luna: "Beside it, in the shade. The water has a clearer outline from there.",
  }
  const beat = (speaker, dialogue, index, action = "talk") => ({
    speaker,
    dialogue,
    emotion: "curious",
    action,
    targetLocation: null,
    replyTo: index ? index - 1 : null,
    references: [],
  })
  const beats = [beat(a, opening[a], 0)]
  if (!b)
    beats.push(
      beat(
        a,
        "I'll start with the edge of the basin and leave room for the spray.",
        1,
        "sketch"
      )
    )
  else {
    beats.push(beat(b, answer[b], 1))
    if (plan.arrival) {
      const name = third[0].toUpperCase() + third.slice(1)
      beats.push(
        beat(
          a,
          `${name}, we're choosing a place to sit beside the fountain.`,
          2,
          "wave"
        )
      )
      beats.push(
        beat(third, "There is room in the shade. I'll join you there.", 3)
      )
    } else if (third)
      beats.push(
        beat(
          third,
          "I'll take the shady side so I can see the water clearly.",
          2
        )
      )
    const tired = world.agents.find((x) => x.id === a).energy < 35
    const last = beat(
      a,
      tired
        ? "I'm tired. I'll leave you to the fountain and find a place to rest."
        : "The shade sounds right. Let's settle there for a while.",
      beats.length,
      tired ? "walk_to" : "sit"
    )
    if (tired) last.targetLocation = plan.destinations[a]
    beats.push(last)
    beats.push(
      beat(
        b,
        tired
          ? "Rest well. I'll stay here and watch the water."
          : "All right. I'll make room beside me.",
        beats.length
      )
    )
    if (third && !plan.arrival)
      beats.push(
        beat(
          third,
          "Good. I'll sit here and start with the shape of the basin.",
          beats.length,
          "sit"
        )
      )
  }
  return {
    sceneId: `scene-${plan.number}`,
    participants: plan.participants,
    sceneType: plan.sceneType,
    summary: "Neighbors choose where to sit beside the fountain.",
    ending: "closure",
    beats,
    suggestedMemoryUpdates: [
      { residentId: a, beatIndex: 0, kind: "conversation" },
    ],
    suggestedRelationshipChanges: b
      ? [{ from: b, to: a, beatIndex: 1, delta: 1 }]
      : [],
  }
}
module.exports = { sceneFixture }
