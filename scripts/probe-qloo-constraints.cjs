require("./echoes-runtime.cjs")
const fs = require("node:fs"),
  zlib = require("node:zlib")
const baseline = JSON.parse(
  zlib.gunzipSync(fs.readFileSync("docs/echoes-three-profile-baseline.json.gz"))
)
const profiles = baseline.filter((r) =>
  ["Dorothy", "Carmen", "Yaw"].includes(r.resident.nickname)
)
const probes = fs.existsSync("docs/qloo-constraint-probe.json")
  ? JSON.parse(
      fs.readFileSync("docs/qloo-constraint-probe.json")
    ).probes.filter((p) => p.status)
  : []
async function request(label, path, params) {
  const prior = probes.find((p) => p.label === label)
  if (prior) return prior
  const url = new URL(path, "https://hackathon.api.qloo.com")
  url.search = new URLSearchParams(params)
  try {
    const response = await fetch(url, {
      headers: {
        "X-Api-Key": process.env.QLOO_API_KEY,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(12000),
    })
    const payload = await response.json()
    const rows = Array.isArray(payload.results)
      ? payload.results
      : (payload.results?.entities ?? payload.results?.tags ?? [])
    const entry = {
      label,
      path,
      params,
      status: response.status,
      count: rows.length,
      rows,
      payload,
    }
    probes.push(entry)
    console.log(
      JSON.stringify({
        label,
        status: response.status,
        count: rows.length,
        names: rows.map((r) => r.name),
        error: payload.error ?? payload.errors,
      })
    )
    return entry
  } catch (e) {
    probes.push({ label, path, params, error: e.message })
    console.log(JSON.stringify({ label, error: e.message }))
    return { rows: [] }
  }
}
;(async () => {
  for (const profile of profiles) {
    const country = profile.resident.country,
      seed = profile.kit.dateChecks.find(
        (c) => c.favorite && c.entity.type === "urn:entity:artist"
      ).entity
    const base = {
      "signal.interests.entities": seed.entityId,
      take: "5",
      "bias.trends": "off",
    }
    for (const type of ["artist", "movie", "tv_show", "book"]) {
      const params = { ...base, "filter.type": "urn:entity:" + type }
      if (type === "book")
        Object.assign(params, {
          "filter.publication_year.min": String(profile.kit.era.from),
          "filter.publication_year.max": String(profile.kit.era.to),
        })
      if (type === "movie")
        Object.assign(params, {
          "filter.release_year.min": String(profile.kit.era.from),
          "filter.release_year.max": String(profile.kit.era.to),
        })
      if (type === "tv_show")
        params["filter.release_year.max"] = String(profile.kit.era.to)
      await request(
        `${profile.resident.nickname}/${type}/era`,
        "/v2/insights",
        params
      )
      await request(
        `${profile.resident.nickname}/${type}/country-name`,
        "/v2/insights",
        { ...params, "filter.release_country": country }
      )
      if (type === "artist")
        await request(
          `${profile.resident.nickname}/artist/start-year`,
          "/v2/insights",
          { ...params, "filter.start_year.max": String(profile.kit.era.to) }
        )
    }
  }
  for (const query of ["Ghana", "Cuba", "Highlife", "Son Cubano"])
    await request(`tags/${query}`, "/v2/tags", {
      "filter.query": query,
      take: "10",
    })
  for (const profile of profiles) {
    const name = profile.resident.nickname,
      country = profile.resident.country
    const seed = profile.kit.dateChecks.find(
      (c) => c.favorite && c.entity.type === "urn:entity:artist"
    ).entity
    const base = {
      "filter.type": "urn:entity:artist",
      "signal.interests.entities": seed.entityId,
      take: "5",
      "bias.trends": "off",
    }
    const tags = await request(`tags/${country}`, "/v2/tags", {
      "filter.query": country,
      take: "10",
    })
    const musicTags = tags.rows
      .filter(
        (t) =>
          t.type === "urn:tag:genre:music" &&
          t.name.toLowerCase() === country.toLowerCase()
      )
      .map((t) => t.tag_id ?? t.id)
    if (musicTags.length)
      await request(`${name}/artist/region-tags-validated`, "/v2/insights", {
        ...base,
        "filter.tags": musicTags.join(","),
        "operator.filter.tags": "union",
      })
    await request(`${name}/artist/impossible-era`, "/v2/insights", {
      ...base,
      "filter.start_year.max": "1900",
      "filter.release_year.max": "1900",
    })
  }
  fs.writeFileSync(
    "docs/qloo-constraint-probe.json",
    JSON.stringify({ createdAt: new Date().toISOString(), probes }, null, 2)
  )
})().catch((e) => {
  console.error(e.message)
  process.exitCode = 1
})
