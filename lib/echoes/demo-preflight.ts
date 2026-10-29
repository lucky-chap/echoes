import { reliabilityDemoProfiles } from "./demo-profiles"
import { demoMode, readProviderCache } from "./provider-cache"
export interface DemoManifest {
  profileId: string
  cacheKeys: string[]
  resolved: number
  dated: number
  failed: number
  resolutionPending: number
}
export function demoPreflight() {
  if (!demoMode()) return []
  const warnings: string[] = []
  for (const profile of reliabilityDemoProfiles) {
    const manifest = readProviderCache<DemoManifest>(
      `demo:${profile.id}`
    )?.value
    if (!manifest)
      warnings.push(`${profile.nickname}: no warm-demo cache manifest.`)
    else {
      const missing = manifest.cacheKeys.filter(
        (key) => !readProviderCache(key)
      ).length
      if (missing || manifest.failed || manifest.resolutionPending)
        warnings.push(
          `${profile.nickname}: ${missing} missing cache entries, ${manifest.failed} failed checks, ${manifest.resolutionPending} unresolved favourites at last warm-up.`
        )
    }
  }
  if (warnings.length)
    console.warn(
      "Echoes DEMO_MODE preflight: run npm run warm-demo before presenting.\n" +
        warnings.join("\n")
    )
  return warnings
}
