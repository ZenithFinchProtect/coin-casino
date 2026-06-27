import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  COINFLIP_MULTIPLIER,
  COINFLIP_WIN_CHANCE,
  isValidBet,
  rollWin,
  roundCoins,
} from "@/lib/games";

export const runtime = "edge";

type Side = "heads" | "tails";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; choice?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  const choice = body.choice;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (choice !== "heads" && choice !== "tails") {
    return NextResponse.json({ error: "invalid_choice" }, { status: 400 });
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

  const win = rollWin(COINFLIP_WIN_CHANCE);
  const landed: Side = win ? (choice as Side) : choice === "heads" ? "tails" : "heads";
  let payout = 0;

  if (win) {
    payout = roundCoins(bet * COINFLIP_MULTIPLIER);
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    choice,
    landed,
    bet,
    payout,
    profit: roundCoins(win ? payout - bet : -bet),
    balance,
  });
}
