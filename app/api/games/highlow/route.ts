import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  HILO_MULTIPLIER,
  HILO_RANKS,
  HILO_WIN_CHANCE,
  isValidBet,
  rollWin,
  secureInt,
} from "@/lib/games";

export const runtime = "edge";

type Pick = "higher" | "lower";

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
  if (pick !== "higher" && pick !== "lower") {
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

  const win = rollWin(HILO_WIN_CHANCE);
  // Keep the current card away from the edges so both guesses are satisfiable.
  const current = 2 + secureInt(HILO_RANKS - 2); // 2..12
  // Next card is higher exactly when the guess is correct on "higher", or wrong
  // on "lower".
  const nextHigher = (pick === "higher") === win;
  const next = nextHigher
    ? current + 1 + secureInt(HILO_RANKS - current) // current+1..13
    : 1 + secureInt(current - 1); // 1..current-1

  let payout = 0;
  if (win) {
    payout = bet * HILO_MULTIPLIER;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    pick,
    current,
    next,
    bet,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
