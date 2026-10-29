import { z } from "zod"
import {
  acceptFamilySubmission,
  issueInvite,
  StoreError,
  transaction,
} from "@/lib/echoes/secure-store"
import {
  limitedJson,
  privateHeaders,
  routeError,
  sameSite,
  withCaregiver,
} from "@/lib/echoes/access"
import { residentSchema } from "@/lib/echoes/validation"
import { allowEchoesRequest } from "@/lib/echoes/rate-limit"
export const runtime = "nodejs"
const familyProfile = residentSchema.omit({
  id: true,
  nickname: true,
  consent: true,
})
export async function GET(request: Request) {
  try {
    return Response.json(
      withCaregiver(request, (data) => ({
        submissions: data.submissions,
        invites: data.invites.map(({ id, residentId, expires, used }) => ({
          id,
          residentId,
          expires,
          used,
        })),
      })),
      { headers: privateHeaders }
    )
  } catch (error) {
    return routeError(error)
  }
}
export async function POST(request: Request) {
  try {
    if (!sameSite(request))
      throw new StoreError("Same-origin request required.", 403)
    if (!allowEchoesRequest(request, 12, 60000))
      throw new StoreError("Please wait a moment and try again.", 429)
    const raw = await limitedJson(request, 12000)
    if (raw.action === "submit") {
      const body = z
        .object({
          token: z.string().regex(/^[a-f\d]{64}$/),
          authority: z.literal(true),
          relationship: z.string().trim().min(2).max(80),
          profile: familyProfile,
        })
        .parse(raw)
      transaction((data) =>
        acceptFamilySubmission(data, body.token, {
          profile: body.profile,
          relationship: body.relationship,
          authority: true,
        })
      )
      // The bearer link is submission-only. Never expose the resident or workspace.
      return Response.json({ submitted: true }, { headers: privateHeaders })
    }
    const body = z
      .object({
        action: z.enum(["invite", "revoke", "accept", "dismiss"]),
        residentId: z.string().max(64).optional(),
        id: z.string().max(64).optional(),
        authority: z.literal(true),
      })
      .parse(raw)
    const result = withCaregiver(request, (data) => {
      if (body.action === "invite") {
        const invite = issueInvite(data, body.residentId ?? "")
        return {
          url: `${new URL(process.env.ECHOES_ORIGIN!).origin}/family#${invite.token}`,
          expires: invite.expires,
          id: invite.id,
        }
      }
      if (body.action === "revoke") {
        data.invites = data.invites.filter((i) => i.id !== body.id)
        return { revoked: true }
      }
      const submission = data.submissions.find((s) => s.id === body.id)
      if (!submission)
        throw new StoreError("Submission is no longer pending.", 404)
      if (body.action === "accept") {
        data.workspace.residents = data.workspace.residents.map((r) =>
          r.id === submission.residentId
            ? {
                ...r,
                ...submission.profile,
                consent: {
                  authority: "caregiver",
                  recordedAt: new Date().toISOString(),
                },
              }
            : r
        )
        data.workspace.memories = [
          ...(data.workspace.memories ?? []),
          {
            id: submission.id,
            residentId: submission.residentId,
            kind: "biography",
            status: "confirmed",
            text: `Family-provided, reviewed by caregiver (${submission.relationship}): born ${submission.profile.birthYear}; ${submission.profile.hometown}, ${submission.profile.country}. Favourites: ${submission.profile.lovedThings.join(", ")}. Avoid: ${submission.profile.sensitivities.join(", ")}. ${submission.profile.importantMemories ?? ""}`,
            source: "family",
            createdAt: submission.receivedAt,
          },
        ]
        data.revision++
      }
      data.submissions = data.submissions.filter((s) => s.id !== body.id)
      return { reviewed: true }
    })
    return Response.json(result, { headers: privateHeaders })
  } catch (error) {
    return routeError(error)
  }
}
