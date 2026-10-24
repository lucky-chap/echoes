import { sameOrigin } from "@/lib/world/server/origin"
import { NextRequest, NextResponse } from "next/server"
import { createSession } from "@/lib/world/server/quota"
export const runtime = "nodejs"
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Same-origin request required" },
      { status: 403 }
    )
  try {
    const response = NextResponse.json({ ok: true })
    response.cookies.set("world-session", createSession(), {
      httpOnly: true,
      sameSite: "strict",
      secure: request.headers.get("origin")?.startsWith("https://") ?? false,
      path: "/api/world",
      maxAge: 86400,
    })
    return response
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Session unavailable" },
      { status: 429 }
    )
  }
}
