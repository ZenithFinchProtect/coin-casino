import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import {
  BLACKJACK_MULTIPLIER,
  BLACKJACK_WIN_CHANCE,
  isValidBet,
  rollWin,
  secureInt,
} from "@/lib/games";

export const runtime = "edge";

/** Build a plausible hand of card values (2..11) that sums to `total`. */
function handForTotal(total: number): number[] {
  const cards: number[] = [];
  let remaining = total;
  while (remaining > 11) {
    cards.push(10);
    remaining -= 10;
  }
  cards.push(remaining);
  return cards;
}

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

  const win = rollWin(BLACKJACK_WIN_CHANCE);

  let playerTotal: number;
  let dealerTotal: number;
  if (win) {
    // Player stands 18..21; dealer either falls short (17..player-1) or busts.
    playerTotal = 18 + secureInt(4); // 18..21
    if (secureInt(2) === 0) {
      dealerTotal = 17 + secureInt(playerTotal - 17); // 17..player-1
    } else {
      dealerTotal = 22 + secureInt(5); // bust 22..26
    }
  } else {
    // Dealer stands 17..21; player either falls short or busts.
    dealerTotal = 17 + secureInt(5); // 17..21
    if (secureInt(2) === 0 && dealerTotal > 17) {
      playerTotal = 17 + secureInt(dealerTotal - 17); // 17..dealer-1
    } else {
      playerTotal = 22 + secureInt(5); // bust 22..26
    }
  }

  let payout = 0;
  if (win) {
    payout = bet * BLACKJACK_MULTIPLIER;
    try {
      balance = await adjustBalance(user.id, payout);
    } catch {
      return NextResponse.json({ error: "payout_failed" }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: win ? "win" : "lose",
    player: handForTotal(playerTotal),
    dealer: handForTotal(dealerTotal),
    playerTotal,
    dealerTotal,
    bet,
    payout,
    profit: win ? payout - bet : -bet,
    balance,
  });
}
