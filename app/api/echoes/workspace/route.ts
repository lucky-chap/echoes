import { z } from "zod"
import {
  limitedJson,
  privateHeaders,
  routeError,
  withCaregiver,
} from "@/lib/echoes/access"
import { StoreError } from "@/lib/echoes/secure-store"
import { workspaceSchema } from "@/lib/echoes/storage-validation"
import { removeResidentData } from "@/lib/echoes/workspace"
export const runtime = "nodejs"
export async function GET(request: Request) {
  try {
    return Response.json(
      withCaregiver(request, (data) => ({
        workspace: data.workspace,
        revision: data.revision,
      })),
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
export async function PUT(request: Request) {
  try {
    // Authenticate before parsing a potentially large workspace body.
    withCaregiver(request, () => true)
    const body = z
      .object({ revision: z.number().int(), workspace: workspaceSchema })
      .parse(await limitedJson(request, 12_000_000))
    const revision = withCaregiver(request, (data) => {
      if (body.revision !== data.revision)
        throw new StoreError(
          "Another tablet updated this workspace. Reload before editing again; your local changes have not overwritten theirs.",
          409
        )
      data.workspace = { ...body.workspace, secret: "protected-site" }
      return ++data.revision
    })
    return Response.json({ revision }, { headers: privateHeaders })
  } catch (error) {
    return routeError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    withCaregiver(request, () => true)
    const body = z
      .object({
        residentId: z.string().min(1).max(64),
        revision: z.number().int(),
      })
      .parse(await limitedJson(request, 1000))
    withCaregiver(request, (data) => {
      if (data.revision !== body.revision)
        throw new StoreError(
          "Another tablet updated this workspace. Reload before removing a resident.",
          409
        )
      data.workspace = removeResidentData(data.workspace, body.residentId)
      data.invites = data.invites.filter(
        (i) => i.residentId !== body.residentId
      )
      data.submissions = data.submissions.filter(
        (s) => s.residentId !== body.residentId
      )
      data.revision++
    })
    return Response.json({ removed: true }, { headers: privateHeaders })
  } catch (error) {
    return routeError(error)
  }
}
