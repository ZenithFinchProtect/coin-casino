import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  CRASH_MAX_TARGET,
  CRASH_MIN_TARGET,
  crashWinChanceContinuous,
  isValidBet,
  payoutCoins,
  roundCoins,
  secureUnitInterval,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Stake-style crash with a continuous auto-cashout target. The player sets the
 * multiplier they want to cash out at and watches the rocket climb live; it
 * auto-cashes at the target on a win, or busts below it on a loss. Win chance
 * is HOUSE_RTP / target, so the expected return is HOUSE_RTP at every target.
 * The crash point is decided server-side; the client only animates up to it.
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
    !Number.isFinite(target) ||
    target < CRASH_MIN_TARGET ||
    target > CRASH_MAX_TARGET
  ) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }
  const cashTarget = Math.round(target * 100) / 100;
  const winChance = crashWinChanceContinuous(cashTarget);

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

  const win = secureUnitInterval() < winChance;
  // Win: rocket flies to at least the target. Loss: it busts before it.
  const crashPoint = win
    ? Math.round((cashTarget + secureUnitInterval() * cashTarget) * 100) / 100
    : Math.round(
        (CRASH_MIN_TARGET +
          secureUnitInterval() * (cashTarget - CRASH_MIN_TARGET)) *
          100
      ) / 100;

  let payout = 0;
  if (win) {
    payout = payoutCoins(bet, cashTarget);
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    target: cashTarget,
    crashPoint,
    winChance,
    bet,
    payout,
    profit: roundCoins(win ? payout - bet : -bet),
    balance,
  });
}
