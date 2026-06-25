import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { avatarUrl } from "@/lib/discord";
import { getBalance, CoinApiError } from "@/lib/coins";

export const runtime = "edge";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  let coins: number | null = null;
  let coinError: string | null = null;
  try {
    coins = await getBalance(user.id);
  } catch (e) {
    coinError =
      e instanceof CoinApiError ? e.message : "could not load balance";
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      avatar: avatarUrl(user),
    },
    coins,
    coinError,
  });
}
