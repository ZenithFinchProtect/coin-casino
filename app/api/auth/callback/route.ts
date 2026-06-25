import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchDiscordUser } from "@/lib/discord";
import { signSession, SESSION_COOKIE } from "@/lib/session";

export const runtime = "edge";

const STATE_COOKIE = "oauth_state";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  try {
    const token = await exchangeCode(code, origin);
    const user = await fetchDiscordUser(token);
    const session = await signSession({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      iat: Math.floor(Date.now() / 1000),
    });
    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }
}
