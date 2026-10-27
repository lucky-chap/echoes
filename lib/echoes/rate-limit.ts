const visits = new Map<string, { count: number; resetAt: number }>()

export function allowEchoesRequest(request: Request, limit = 12, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const key = forwarded || request.headers.get("x-real-ip") || "anonymous"
  const now = Date.now()
  const entry = visits.get(key)
  if (!entry || entry.resetAt < now) {
    visits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count += 1
  return entry.count <= limit
}
