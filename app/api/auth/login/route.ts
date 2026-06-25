import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/discord";

export const runtime = "edge";

const STATE_COOKIE = "oauth_state";

export async function GET(req: NextRequest) {
  if (!process.env.DISCORD_CLIENT_ID) {
    return NextResponse.json(
      { error: "Discord login is not configured (missing DISCORD_CLIENT_ID)." },
      { status: 503 }
    );
  }
  const origin = req.nextUrl.origin;
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
