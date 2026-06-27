import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  HILO_RANKS,
  hiloHigherChance,
  hiloLowerChance,
  isValidBet,
  payoutCoins,
  payoutMultiplier,
  roundCoins,
  roundMultiplier,
  secureInt,
  secureUnitInterval,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Stake-style High/Low with real card odds. A card (1=Ace .. 13=King) is shown;
 * "higher" wins if the next card is the same or higher, "lower" if it is the
 * same or lower. The multiplier is HOUSE_RTP / trueChance, so the odds are
 * authentic with a constant edge — and because multiplier == HOUSE_RTP / p for
 * the exact p used to roll the result, the expected return is HOUSE_RTP for
 * every shown card, so the client supplying the shown rank cannot shift the EV.
 *
 * With no `pick` in the body this just deals a fresh starting card (no stake).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; pick?: unknown; rank?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Deal mode: hand out a fresh shown card with no wager.
  if (body.pick === undefined || body.pick === null) {
    return NextResponse.json({ rank: 1 + secureInt(HILO_RANKS) });
  }

  const bet = body.bet;
  const pick = body.pick;
  const rank = body.rank;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (pick !== "higher" && pick !== "lower") {
    return NextResponse.json({ error: "invalid_pick" }, { status: 400 });
  }
  if (
    typeof rank !== "number" ||
    !Number.isInteger(rank) ||
    rank < 1 ||
    rank > HILO_RANKS
  ) {
    return NextResponse.json({ error: "invalid_rank" }, { status: 400 });
  }

  const winChance =
    pick === "higher" ? hiloHigherChance(rank) : hiloLowerChance(rank);
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

  const win = secureUnitInterval() < winChance;
  // Generate a next card consistent with the outcome and the guess.
  let next: number;
  if (pick === "higher") {
    next = win
      ? rank + secureInt(HILO_RANKS - rank + 1) // rank..13
      : 1 + secureInt(rank - 1); // 1..rank-1
  } else {
    next = win
      ? 1 + secureInt(rank) // 1..rank
      : rank + 1 + secureInt(HILO_RANKS - rank); // rank+1..13
  }

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
    pick,
    current: rank,
    next,
    winChance,
    multiplier,
    bet,
    payout,
    profit: roundCoins(win ? payout - bet : -bet),
    balance,
  });
}
