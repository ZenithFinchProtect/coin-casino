import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  MINES_MULTIPLIER,
  MINES_TARGET,
  isValidBet,
  rollWin,
  secureInt,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Resolves a full mines round in one authoritative call. The win/lose outcome
 * is decided server-side (20% win chance); the client merely animates the
 * tile-by-tile reveal. On a loss, `bustStep` (1-based) marks which of the
 * player's picks detonates, so the reveal still builds tension.
 */
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

  const win = rollWin();
  let payout = 0;
  let bustStep: number | null = null;

  if (win) {
    payout = bet * MINES_MULTIPLIER;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  } else {
    bustStep = secureInt(MINES_TARGET) + 1; // 1..MINES_TARGET
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    bet,
    target: MINES_TARGET,
    multiplier: MINES_MULTIPLIER,
    bustStep,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
