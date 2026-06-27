import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  diceWinChance,
  isValidBet,
  payoutCoins,
  payoutMultiplier,
  roundCoins,
  roundMultiplier,
  rollWin,
  secureUnitInterval,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Stake-style dice. The player picks a roll-over `target` on a 0.00-100.00
 * scale; they win if the roll lands strictly above it. Win chance and payout
 * multiplier are derived from the target (payout = HOUSE_RTP / winChance), so
 * the house edge is constant no matter where the slider sits. The win/lose
 * outcome is decided server-side; the client just animates the roll landing on
 * the returned value.
 */
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
    !Number.isInteger(target) ||
    target < DICE_MIN_TARGET ||
    target > DICE_MAX_TARGET
  ) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const winChance = diceWinChance(target);
  const multiplier = roundMultiplier(payoutMultiplier(winChance));

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

  const win = rollWin(winChance);
  // On a win the roll lands in (target, 100]; on a loss in [0, target].
  const roll = win
    ? target + secureUnitInterval() * (100 - target)
    : secureUnitInterval() * target;
  const rollValue = Math.round(roll * 100) / 100;

  let payout = 0;
  if (win) {
    payout = payoutCoins(bet, multiplier);
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    target,
    roll: rollValue,
    winChance,
    multiplier,
    bet,
    payout,
    profit: roundCoins(win ? payout - bet : -bet),
    balance,
  });
}
