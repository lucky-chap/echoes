/** Next may normalize request.url to localhost behind its production server.
 * Compare the browser Origin with the actual Host header (or an explicit public origin). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const url = new URL(origin)
    if (!["http:", "https:"].includes(url.protocol)) return false
    if (process.env.WORLDLINGS_ORIGIN)
      return url.origin === new URL(process.env.WORLDLINGS_ORIGIN).origin
    return url.host === request.headers.get("host")
  } catch {
    return false
  }
}
