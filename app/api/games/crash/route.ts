import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  CRASH_TARGETS,
  crashWinChance,
  isValidBet,
  rollWin,
  secureUnitInterval,
} from "@/lib/games";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  const target = body.target;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (
    typeof target !== "number" ||
    !(CRASH_TARGETS as readonly number[]).includes(target)
  ) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
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

  const win = rollWin(crashWinChance(target));
  // The rocket crashes at or above the target on a win, below it on a loss.
  const crashPoint = win
    ? Math.round((target + secureUnitInterval() * 2) * 100) / 100
    : Math.round((1 + secureUnitInterval() * (target - 1)) * 100) / 100;

  let payout = 0;
  if (win) {
    payout = bet * target;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    target,
    crashPoint,
    bet,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
