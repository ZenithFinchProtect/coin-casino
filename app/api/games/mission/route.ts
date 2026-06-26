import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  MISSION_LANES,
  MISSION_MULTIPLIER,
  MISSION_WIN_CHANCE,
  isValidBet,
  rollWin,
  secureInt,
} from "@/lib/games";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }

  // Debit the stake first so a player can never bet coins they don't have.
  let balance: number;
  try {
    balance = await adjustBalance(user.id, -bet);
  } catch (e) {
    if (e instanceof CoinApiError && e.status === 409) {
      return NextResponse.json(
        { error: "insufficient_balance", coins: e.balance },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "coin_api_error" }, { status: 502 });
  }

  const win = rollWin(MISSION_WIN_CHANCE);
  // On a loss, the chicken is hit somewhere along the way (lane 1..MISSION_LANES).
  const bustLane = win ? null : 1 + secureInt(MISSION_LANES);

  let payout = 0;
  if (win) {
    payout = bet * MISSION_MULTIPLIER;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    lanes: MISSION_LANES,
    bustLane,
    bet,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
