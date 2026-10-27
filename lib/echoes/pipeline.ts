import { eraWindow, selectForCoverage, sharedEraWindow } from "./era"
import { exclusionsFor } from "./feedback"
import { EchoesQlooClient, resolveLovedThings } from "./qloo"
import type { AgentTrace, EchoesEntity, EchoesEntityType, FeedbackRecord, KitItem, ResidentInput, SessionKit } from "./types"
import { dropUnresolvedItems } from "./verified"
import { retainEraVerifiedItems, verifyYearFact } from "./year-facts"

const outputTypes: { type: EchoesEntityType; kind: KitItem["kind"] }[] = [
  { type: "urn:entity:artist", kind: "music" },
  { type: "urn:entity:movie", kind: "film" },
  { type: "urn:entity:tv_show", kind: "television" },
  { type: "urn:entity:book", kind: "book" },
  { type: "urn:entity:place", kind: "place" },
]

function kindFor(type: EchoesEntityType): KitItem["kind"] {
  return outputTypes.find((option) => option.type === type)?.kind ?? "music"
}

function uniqueById(entities: EchoesEntity[]) {
  return [...new Map(entities.map((entity) => [entity.entityId, entity])).values()]
}

function promptsFor(items: KitItem[], residents: ResidentInput[]) {
  const names = items.slice(0, 3).map((item) => item.name).join(", ")
  const language = residents[0]?.language || "your preferred language"
  return [
    `Would ${names || "any of these familiar choices"} be a comfortable place to begin today?`,
    `What does it bring to mind—people, places, or a small routine? Share only what feels good to share.`,
    `Would you like to listen, look, or simply talk about it in ${language}?`,
  ]
}

export async function generateSessionKit(input: {
  residents: ResidentInput[]
  feedback: FeedbackRecord[]
}) {
  const client = new EchoesQlooClient()
  const { residents, feedback } = input
  const trace = (tool: AgentTrace["tool"], summary: string): AgentTrace => ({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), tool, summary })
  const era = sharedEraWindow(residents)
  const perResident = await Promise.all(residents.map(async (resident) => {
    const resolved = await resolveLovedThings(client, resident)
    const learned = feedback
      .filter((item) => item.residentId === resident.id && item.status === "sparked")
      .map((item) => item.entityId)
    const excluded = exclusionsFor(feedback, resident.id)
    const excludedTags = (await Promise.all(resident.sensitivities.map((sensitivity) => client.tags(sensitivity)))).flat()
    const seeds = uniqueById(resolved).map((item) => item.entityId).concat(learned).slice(-10)
    if (!seeds.length) return { resident, candidates: [] as KitItem[], note: `${resident.nickname}'s loved things could not be verified by Qloo, so no items were shown for them.` }
    const residentEra = eraWindow(resident.birthYear)
    const requests = outputTypes.map(async ({ type }) => {
      try {
        return await client.insights({
          type,
          entityIds: seeds,
          era: residentEra,
          hometown: resident.hometown,
          country: resident.country,
          excludedEntityIds: excluded,
          excludedTags,
        })
      } catch { return [] as EchoesEntity[] }
    })
    const candidates = uniqueById((await Promise.all(requests)).flat()).slice(0, 6).map((entity): Omit<KitItem, "yearEvidence"> => ({
      entityId: entity.entityId,
      name: entity.name,
      kind: kindFor(entity.type),
      type: entity.type,
      affinity: entity.affinity,
      matchedResidentIds: [resident.id],
      whyItFits: ["Qloo-verified", `${residentEra.from}–${residentEra.to} reminiscence window`, `Connected to ${resident.nickname}'s verified interests`],
    }))
    return { resident, candidates, note: null }
  }))
  const resolvedCount = perResident.reduce((total, result) => total + result.candidates.length, 0)

  const allCandidateEntities = dropUnresolvedItems(
    perResident.flatMap((result) => result.candidates.map((item) => ({
      entityId: item.entityId, name: item.name, type: item.type, description: null, affinity: item.affinity, properties: {},
    })))
  )
  const allCandidates = uniqueById(allCandidateEntities).map(
    (entity) => perResident.flatMap((result) => result.candidates).find((item) => item.entityId === entity.entityId)!
  )

  // Score the shared pool for every resident. If Qloo declines a narrow candidate-pool
  // request, their original verified result remains usable and is clearly attributable.
  await Promise.all(perResident.map(async ({ resident }) => {
    const seedEntities = await resolveLovedThings(client, resident)
    const seeds = seedEntities.map((item) => item.entityId).concat(feedback.filter((item) => item.residentId === resident.id && item.status === "sparked").map((item) => item.entityId))
    if (!seeds.length) return
    await Promise.all(outputTypes.map(async ({ type }) => {
      const ids = allCandidates.filter((item) => item.type === type).map((item) => item.entityId)
      if (!ids.length) return
      try {
        const scored = await client.insights({ type, entityIds: seeds, era: eraWindow(resident.birthYear), candidateIds: ids })
        const scoredIds = new Set(scored.map((item) => item.entityId))
        allCandidates.forEach((candidate) => {
          if (scoredIds.has(candidate.entityId) && !candidate.matchedResidentIds.includes(resident.id)) {
            candidate.matchedResidentIds.push(resident.id)
            candidate.whyItFits.push(`Qloo found a connection for ${resident.nickname}`)
          }
        })
      } catch { /* graceful domain-level degradation */ }
    }))
  }))

  const evidence = new Map(await Promise.all(allCandidates.map(async (candidate) => [
    candidate.entityId,
    await verifyYearFact(candidate.name, candidate.type, residents),
  ] as const)))
  const verifiedCandidates = retainEraVerifiedItems(allCandidates, evidence).flatMap((candidate) => {
    const matchedResidentIds = candidate.matchedResidentIds.filter((id) => candidate.yearEvidence.residentIds.includes(id))
    return matchedResidentIds.length ? [{ ...candidate, matchedResidentIds }] : []
  })
  const selection = selectForCoverage(verifiedCandidates, residents.map((resident) => resident.id))
  const underservedNames = residents.filter((resident) => !selection.servedResidentIds.includes(resident.id)).map((resident) => resident.nickname)
  const notes = perResident.flatMap((result) => result.note ? [result.note] : [])
  if (!selection.items.length) notes.push("Echoes could not confirm an independently dated Qloo match in the reminiscence window. Try another loved thing or a little later.")
  if (underservedNames.length) notes.push(`Coverage note: ${underservedNames.join(", ")} may need a more tailored follow-up.`)
  const kit: SessionKit = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    residents: residents.map(({ id, nickname, language, hometown }) => ({ id, nickname, language, hometown })),
    era,
    items: selection.items,
    prompts: promptsFor(selection.items, residents),
    aboutMe: {
      title: residents.length === 1 ? `A few things for ${residents[0].nickname}` : "A few things to share",
      opening: "Use this page as a gentle invitation. Follow the person's lead and skip anything that does not feel right.",
      details: residents.flatMap((resident) => [
        `${resident.nickname} grew up in ${resident.hometown}, ${resident.country}.`,
        `Their reminiscence window is ${eraWindow(resident.birthYear).from}–${eraWindow(resident.birthYear).to}.`,
      ]),
    },
    coverage: { percent: selection.percent, servedResidentIds: selection.servedResidentIds, underservedNames },
    notes,
    agentTrace: [
      trace("memory_read", `Read ${feedback.length} saved response${feedback.length === 1 ? "" : "s"} for the selected people.`),
      trace("qloo_search", `Resolved anchors and expanded ${resolvedCount} Qloo candidates.`),
      trace("qloo_insights", `Ranked candidates against each person's verified interests and safeguards.`),
      trace("safety_filter", `Applied ${feedback.filter((item) => item.status === "distressed").length} saved exclusion${feedback.filter((item) => item.status === "distressed").length === 1 ? "" : "s"} and sensitivity filters.`),
      trace("era_verify", `Kept ${verifiedCandidates.length} independently dated candidate${verifiedCandidates.length === 1 ? "" : "s"}; dropped ${allCandidates.length - verifiedCandidates.length} without a matching era fact.`),
      trace("qloo_score", `Scored the verified candidate pool for ${residents.length === 1 ? "one person" : `${residents.length} people`}.`),
      trace("group_optimizer", residents.length > 1 ? `Selected ${selection.items.length} items with ${selection.percent}% group coverage.` : `Selected ${selection.items.length} tailored item${selection.items.length === 1 ? "" : "s"}.`),
    ],
  }
  return kit
}
