import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  MISSION_MAX_LANES,
  MISSION_SURVIVE,
  isValidBet,
  missionMultiplier,
  missionWinChance,
  payoutCoins,
  roundCoins,
  secureUnitInterval,
} from "@/lib/games";

export const runtime = "edge";

/**
 * Stake-style "Chicken" crossing. The player commits to crossing `lanes` lanes;
 * each lane has a fixed survival chance (MISSION_SURVIVE), so the cash-out
 * multiplier grows the further they go while the expected return stays at
 * HOUSE_RTP. The win/lose outcome and (on a loss) which lane the chicken is hit
 * on are decided server-side; the client animates the crossing lane by lane.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { bet?: unknown; lanes?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const bet = body.bet;
  const lanes = body.lanes;
  if (!isValidBet(bet)) {
    return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
  }
  if (
    typeof lanes !== "number" ||
    !Number.isInteger(lanes) ||
    lanes < 1 ||
    lanes > MISSION_MAX_LANES
  ) {
    return NextResponse.json({ error: "invalid_lanes" }, { status: 400 });
  }

  const winChance = missionWinChance(lanes);
  const multiplier = missionMultiplier(lanes);

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

  // Walk lane by lane: each lane is survived with probability MISSION_SURVIVE.
  // This yields the correct overall win chance (MISSION_SURVIVE^lanes) and a
  // realistic bust lane on a loss.
  let bustLane: number | null = null;
  for (let lane = 1; lane <= lanes; lane++) {
    if (secureUnitInterval() >= MISSION_SURVIVE) {
      bustLane = lane;
      break;
    }
  }
  const win = bustLane === null;

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
    lanes,
    bustLane,
    winChance,
    multiplier,
    bet,
    payout,
    profit: roundCoins(win ? payout - bet : -bet),
    balance,
  });
}
