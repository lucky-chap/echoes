import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmdirSync,
} from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import type { DialogueProvider } from "./groq"
interface Session {
  calls: number
  last: number
  blocked: boolean
  input: number
  output: number
  reserved?: number
}
interface Ledger {
  backup?: Ledger
  version?: number
  day: string
  calls: number
  tokens: number
  minute: number
  minuteCalls: number
  minuteTokens: number
  cooldown?: number
  providerTokens?: number
  providerReset?: number
  providerRequests?: number
  sessions: Record<string, Session>
}

function freshLedger(day: string): Ledger {
  return {
    version: 2,
    day,
    calls: 0,
    tokens: 0,
    minute: 0,
    minuteCalls: 0,
    minuteTokens: 0,
    sessions: {},
  }
}

function migrateLedger(ledger: Ledger) {
  if (ledger.version === 2) return ledger
  // Version 1 retained worst-case reservations even after provider usage was
  // known. Rebuild token usage from completed calls; no request is in flight
  // while a new server process is loading this migration.
  ledger.tokens = Object.values(ledger.sessions).reduce(
    (total, session) => total + session.input + session.output,
    0
  )
  ledger.minuteTokens = 0
  for (const session of Object.values(ledger.sessions)) session.reserved = 0
  ledger.version = 2
  return ledger
}
export function setting(name: string, fallback: number, max = 100000) {
  const n = Number(process.env[name])
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback
}
export const sessionLimit = () => setting("MAX_LLM_CALLS_PER_SESSION", 60, 500)
export function liveUnavailable(provider: DialogueProvider = "groq") {
  if (process.env.LLM_PROVIDER !== "groq")
    return "LLM_PROVIDER is not groq. Dialogue withheld; independent activities continue."
  if (provider === "cerebras") {
    if (process.env.CEREBRAS_BACKUP_ENABLED !== "true")
      return "Cerebras backup is disabled."
    if (!process.env.CEREBRAS_API_KEY)
      return "CEREBRAS_API_KEY is not configured."
  } else {
    if (!process.env.GROQ_API_KEY) return "GROQ_API_KEY is not configured."
    if (process.env.GROQ_PLAN === "developer") {
      if (process.env.GROQ_PAID_USAGE_CONFIRMED !== "true")
        return "Confirm paid Groq usage before enabling the Developer plan."
    } else if (process.env.GROQ_FREE_PLAN_CONFIRMED !== "true")
      return "Confirm the account uses the Groq Free Plan before enabling live generation."
  }
  const prefix = provider === "groq" ? "GROQ" : "CEREBRAS"
  if (
    ![
      "DAILY_REQUEST_LIMIT",
      "REQUESTS_PER_MINUTE",
      "TOKENS_PER_MINUTE",
      "DAILY_TOKEN_LIMIT",
    ].every((k) => Number(process.env[`${prefix}_${k}`]) > 0)
  )
    return `Configure ${prefix} request and token ceilings below your account limits.`
  if (
    process.env.NODE_ENV === "production" &&
    (process.env.WORLDLINGS_SINGLE_INSTANCE !== "true" ||
      !process.env.WORLDLINGS_QUOTA_DIR)
  )
    return "Public live generation requires a single server with a persistent quota directory. Dialogue withheld; independent activities continue."
  return null
}
/** Atomic filesystem lock, durable reservations before network I/O. Fail closed on storage errors.
 * Public deployments MUST use one instance with a persistent volume; serverless stays mock. */
function transaction<T>(fn: (ledger: Ledger) => T): T {
  const root =
    process.env.WORLDLINGS_QUOTA_DIR || join(process.cwd(), ".worldlings")
  mkdirSync(root, { recursive: true })
  const lock = join(root, "quota.lock")
  try {
    mkdirSync(lock)
  } catch {
    throw Error("Quota storage busy; try again shortly.")
  }
  try {
    let ledger: Ledger
    const day = new Date().toISOString().slice(0, 10)
    try {
      ledger = JSON.parse(readFileSync(join(root, "quota.json"), "utf8"))
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
      ledger = freshLedger("")
    }
    ledger = migrateLedger(ledger)
    if (ledger.day !== day) ledger = freshLedger(day)
    const result = fn(ledger)
    writeFileSync(join(root, "quota.tmp"), JSON.stringify(ledger), {
      mode: 0o600,
    })
    renameSync(join(root, "quota.tmp"), join(root, "quota.json"))
    return result
  } finally {
    rmdirSync(lock)
  }
}
export function createSession() {
  return transaction((l) => {
    if (Object.keys(l.sessions).length >= 100)
      throw Error("Daily session ceiling reached. Continue in offline mode.")
    const id = randomUUID()
    l.sessions[id] = {
      calls: 0,
      last: 0,
      blocked: false,
      input: 0,
      output: 0,
      reserved: 0,
    }
    return id
  })
}
export function sessionStatus(id: string) {
  return transaction((l) => {
    if (!l.sessions[id])
      throw Error("Session expired. Press Continue to start another.")
    return {
      ...l.sessions[id],
      calls: l.sessions[id].calls + (l.backup?.sessions[id]?.calls ?? 0),
    }
  })
}
function providerLedger(root: Ledger, provider: DialogueProvider) {
  if (provider === "groq") return root
  return (root.backup ??= freshLedger(root.day))
}
export class QuotaWait extends Error {
  constructor(
    message: string,
    readonly retryAt: number
  ) {
    super(message)
  }
}
export function reserve(
  id: string,
  tokens: number,
  provider: DialogueProvider = "groq"
) {
  return transaction((root) => {
    if (!root.sessions[id]) throw Error("Session expired. Press Continue.")
    const l = providerLedger(root, provider)
    if (!l.sessions[id])
      l.sessions[id] = {
        calls: 0,
        last: 0,
        blocked: false,
        input: 0,
        output: 0,
        reserved: 0,
      }
    const s = l.sessions[id]
    if (!s) throw Error("Session expired. Press Continue.")
    if (s.blocked)
      throw Error(
        "Live generation paused for this session after a provider error."
      )
    const totalCalls =
      root.sessions[id].calls + (root.backup?.sessions[id]?.calls ?? 0)
    if (totalCalls >= sessionLimit())
      throw Error(
        "Session call limit reached. Press Continue at the checkpoint."
      )
    const now = Date.now(),
      minute = Math.floor(now / 60000)
    if (l.cooldown && now < l.cooldown)
      throw new QuotaWait(
        `${provider} rate-limit cooldown is active.`,
        l.cooldown
      )
    if (l.minute !== minute) {
      l.minute = minute
      l.minuteCalls = 0
      l.minuteTokens = 0
    }
    if (
      l.providerReset &&
      now < l.providerReset &&
      l.providerTokens !== undefined &&
      l.providerTokens < tokens
    )
      throw new QuotaWait(
        `${provider} account token window is resting.`,
        l.providerReset
      )
    if (l.providerRequests !== undefined && l.providerRequests < 1)
      throw Error("Groq account daily request allowance is exhausted.")
    if (now - s.last < 1500)
      throw new QuotaWait(
        "Requests are too close together. The current gathering is preserved.",
        s.last + 1500
      )
    const limit = (suffix: string, fallback: number, max = 100000) =>
      setting(
        `${provider === "groq" ? "GROQ" : "CEREBRAS"}_${suffix}`,
        fallback,
        max
      )
    if (tokens > limit("TOKENS_PER_MINUTE", 12000, 1000000000))
      throw Error(
        `${provider} scene reservation exceeds the configured minute token ceiling.`
      )
    if (
      l.calls >= limit("DAILY_REQUEST_LIMIT", 20) ||
      l.tokens + tokens > limit("DAILY_TOKEN_LIMIT", 40000, 1000000000)
    )
      throw Error(
        "Daily free-use ceiling reached. Dialogue withheld; independent activities continue."
      )
    if (
      l.minuteCalls >= limit("REQUESTS_PER_MINUTE", 2, 25) ||
      l.minuteTokens + tokens > limit("TOKENS_PER_MINUTE", 12000, 1000000000)
    )
      throw new QuotaWait(
        `${provider} server minute ceiling reached.`,
        (minute + 1) * 60000
      )
    if (l.providerTokens !== undefined)
      l.providerTokens = Math.max(0, l.providerTokens - tokens)
    if (l.providerRequests !== undefined) l.providerRequests--
    s.calls++
    s.last = now
    s.reserved = (s.reserved ?? 0) + tokens
    l.calls++
    l.tokens += tokens
    l.minuteCalls++
    l.minuteTokens += tokens
    return totalCalls + 1
  })
}
export function recordUsage(
  id: string,
  input: number,
  output: number,
  blocked = false,
  provider: DialogueProvider = "groq"
) {
  transaction((root) => {
    const l = providerLedger(root, provider)
    const s = l.sessions[id]
    if (s) {
      const reserved = s.reserved ?? 0
      if (reserved) {
        const actual = input + output
        l.tokens = Math.max(0, l.tokens + actual - reserved)
        if (l.minute === Math.floor(Date.now() / 60000))
          l.minuteTokens = Math.max(0, l.minuteTokens + actual - reserved)
        s.reserved = 0
      }
      s.input += input
      s.output += output
      s.blocked ||= blocked
    }
  })
}

export function recordRateHeaders(
  headers: Headers,
  provider: DialogueProvider = "groq"
) {
  // Groq-specific rate headers are not interpreted as another provider's quota.
  if (provider !== "groq") return
  transaction((l) => {
    const tokens = headers.get("x-ratelimit-remaining-tokens"),
      requests = headers.get("x-ratelimit-remaining-requests")
    if (tokens !== null && Number.isFinite(Number(tokens)))
      l.providerTokens = Number(tokens)
    if (requests !== null && Number.isFinite(Number(requests)))
      l.providerRequests = Number(requests)
    const reset = headers.get("x-ratelimit-reset-tokens") || "60s"
    const units: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60000,
      h: 3600000,
    }
    let duration = 0
    for (const match of reset.matchAll(/([\d.]+)(ms|s|m|h)/g))
      duration += Number(match[1]) * units[match[2]]
    l.providerReset =
      Date.now() + Math.max(1000, Math.min(86400000, duration || 60000))
  })
}

export function pauseLive(
  seconds: number,
  provider: DialogueProvider = "groq"
) {
  return transaction((root) => {
    const l = providerLedger(root, provider)
    l.cooldown =
      Date.now() +
      Math.min(86400, Math.max(1, Number.isFinite(seconds) ? seconds : 60)) *
        1000
    return l.cooldown
  })
}
