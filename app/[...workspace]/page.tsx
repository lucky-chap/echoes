import { notFound } from "next/navigation"
import EchoesApp from "@/components/echoes/echoes-app"

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string[] }>
}) {
  const { workspace } = await params
  const [screen] = workspace
  if (
    !["dashboard", "intake", "kit", "live", "review"].includes(screen) ||
    workspace.length > 2 ||
    (workspace.length === 2 && !["kit", "live", "review"].includes(screen))
  )
    notFound()
  return <EchoesApp />
}
