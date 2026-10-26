/** Process-local coordination for expensive Groq scene requests.
 *
 * The quota ledger remains the cross-request authority.  This manager only
 * prevents duplicate browser retries from producing duplicate provider calls
 * in a single Node process and serializes the free-plan friendly workload.
 */
const pending = new Map<string, Promise<unknown>>()
let tail: Promise<void> = Promise.resolve()

export function managedGroqRequest<T>(key: string, work: () => Promise<T>) {
  const existing = pending.get(key) as Promise<T> | undefined
  if (existing) return existing
  const run = tail.then(work, work)
  tail = run.then(
    () => undefined,
    () => undefined
  )
  pending.set(key, run)
  // Handle both branches here; a detached `finally()` would create a second
  // rejected promise when the provider request fails.
  void run.then(
    () => pending.delete(key),
    () => pending.delete(key)
  )
  return run
}
