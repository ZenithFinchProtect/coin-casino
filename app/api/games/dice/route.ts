import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  DICE_MULTIPLIER,
  DICE_SIDES,
  DICE_WIN_CHANCE,
  isValidBet,
  rollWin,
  secureInt,
} from "@/lib/games";

export const runtime = "edge";

type Pick = "high" | "low";

/** Low = 1..3, High = 4..6 on a six-sided die. */
function rollInRange(high: boolean): number {
  const half = DICE_SIDES / 2;
  // high -> [half+1, DICE_SIDES]; low -> [1, half]
  return high ? half + 1 + secureInt(half) : 1 + secureInt(half);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; pick?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  const pick = body.pick;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (pick !== "high" && pick !== "low") {
    return NextResponse.json({ error: "invalid_pick" }, { status: 400 });
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

  const win = rollWin(DICE_WIN_CHANCE);
  const pickedHigh = pick === "high";
  const roll = rollInRange(win ? pickedHigh : !pickedHigh);
  let payout = 0;

  if (win) {
    payout = bet * DICE_MULTIPLIER;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    pick,
    roll,
    bet,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
