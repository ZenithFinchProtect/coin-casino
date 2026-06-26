import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  PLINKO_DEFAULT_ROWS,
  isValidBet,
  isValidPlinkoRisk,
  isValidPlinkoRows,
  payoutCoins,
  plinkoDrop,
  plinkoMultipliers,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Stake-style Plinko, one ball per coin wagered. Each of the `bet` coins drops
 * its own ball through `rows` rows of pegs, bouncing left/right with equal
 * probability at each peg, landing in one of rows + 1 bins (Binomial(rows,
 * 0.5)). Each ball stakes exactly one coin, so the gross return is the sum of
 * the landed multipliers; we floor that sum once to whole coins (flooring per
 * ball would always zero out sub-1x bins and silently worsen the edge). The
 * multiplier tables are scaled so the expected return is HOUSE_RTP for every
 * (rows, risk) combo. The landing bins are decided server-side; the client
 * animates the balls into them.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; risk?: unknown; rows?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  const risk = body.risk;
  const rows = body.rows ?? PLINKO_DEFAULT_ROWS;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (!isValidPlinkoRisk(risk)) {
    return NextResponse.json({ error: "invalid_risk" }, { status: 400 });
  }
  if (!isValidPlinkoRows(rows)) {
    return NextResponse.json({ error: "invalid_rows" }, { status: 400 });
  }

  const multipliers = plinkoMultipliers(rows, risk);

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

  // One ball per coin: drop `bet` balls, each staking a single coin.
  const bins: number[] = [];
  let multiplierSum = 0;
  for (let i = 0; i < bet; i++) {
    const b = plinkoDrop(rows);
    bins.push(b);
    multiplierSum += multipliers[b];
  }
  // Each ball stakes 1 coin, so the gross return is the multiplier sum; floor
  // the total once to whole coins.
  const payout = payoutCoins(1, multiplierSum);

  if (payout > 0) {
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: payout >= bet ? "win" : "lose",
    risk,
    rows,
    bins,
    multipliers,
    bet,
    payout,
    profit: payout - bet,
    balance,
  });
}
