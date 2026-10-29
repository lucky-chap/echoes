export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { demoPreflight } = await import("./lib/echoes/demo-preflight")
    demoPreflight()
  }
}
