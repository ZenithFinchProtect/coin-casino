import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { adjustBalance, CoinApiError } from "@/lib/coins";
import { isValidBet, roundCoins } from "@/lib/games";
import {
  BlackjackState,
  freshDeck,
  handValue,
  isBlackjack,
  payoutForOutcome,
  playDealer,
  resolveOutcome,
  signState,
  verifyState,
} from "@/lib/blackjack";

export const runtime = "edge";

type Action = "deal" | "hit" | "stand" | "double";

/** Total wagered so far on a hand (doubles to 2x bet when doubled). */
function stakeOf(state: BlackjackState): number {
  return state.bet * (state.doubled ? 2 : 1);
}

/** Build the client-facing view of a hand, hiding the hole card mid-play. */
function view(state: BlackjackState, done: boolean) {
  return {
    player: state.player,
    playerTotal: handValue(state.player).total,
    dealer: done ? state.dealer : [state.dealer[0]],
    dealerTotal: done
      ? handValue(state.dealer).total
      : handValue([state.dealer[0]]).total,
    canHit: !done,
    canDouble: !done && state.player.length === 2,
    canStand: !done,
  };
}

async function settle(
  userId: string,
  state: BlackjackState
): Promise<{ payout: number; balance: number | null; outcome: string }> {
  const outcome = resolveOutcome(state);
  const payout = payoutForOutcome(outcome, state.bet, stakeOf(state));
  let balance: number | null = null;
  if (payout > 0) {
    try {
      balance = await adjustBalance(userId, payout);
    } catch {
      balance = null;
    }
  }
  return { payout, balance, outcome };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { action?: unknown; bet?: unknown; state?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const action = body.action as Action;

  // ---- Deal: start a fresh hand -----------------------------------------
  if (action === "deal") {
    const bet = body.bet;
    if (!isValidBet(bet)) {
      return NextResponse.json({ error: "invalid_bet" }, { status: 400 });
    }

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

    const deck = freshDeck();
    const state: BlackjackState = {
      deck,
      player: [deck.shift()!, deck.shift()!],
      dealer: [deck.shift()!, deck.shift()!],
      bet,
      doubled: false,
      done: false,
    };

    // Naturals end the hand immediately.
    if (isBlackjack(state.player) || isBlackjack(state.dealer)) {
      state.done = true;
      const { payout, balance: credited, outcome } = await settle(
        user.id,
        state
      );
      return NextResponse.json({
        ...view(state, true),
        token: await signState(state),
        done: true,
        outcome,
        bet,
        payout,
        profit: roundCoins(payout - bet),
        balance: credited ?? balance,
      });
    }

    return NextResponse.json({
      ...view(state, false),
      token: await signState(state),
      done: false,
      outcome: null,
      bet,
      payout: 0,
      balance,
    });
  }

  // ---- Continuing actions need a valid signed state ---------------------
  const state = await verifyState(
    typeof body.state === "string" ? body.state : ""
  );
  if (!state) {
    return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  }
  if (state.done) {
    return NextResponse.json({ error: "hand_finished" }, { status: 400 });
  }

  if (action === "hit") {
    state.player.push(state.deck.shift()!);
    const busted = handValue(state.player).total > 21;
    if (busted) state.done = true;
    if (state.done) {
      const { payout, balance, outcome } = await settle(user.id, state);
      return NextResponse.json({
        ...view(state, true),
        token: await signState(state),
        done: true,
        outcome,
        bet: state.bet,
        payout,
        profit: roundCoins(payout - stakeOf(state)),
        balance,
      });
    }
    return NextResponse.json({
      ...view(state, false),
      token: await signState(state),
      done: false,
      outcome: null,
      bet: state.bet,
      payout: 0,
    });
  }

  if (action === "stand") {
    playDealer(state);
    state.done = true;
    const { payout, balance, outcome } = await settle(user.id, state);
    return NextResponse.json({
      ...view(state, true),
      token: await signState(state),
      done: true,
      outcome,
      bet: state.bet,
      payout,
      profit: roundCoins(payout - stakeOf(state)),
      balance,
    });
  }

  if (action === "double") {
    if (state.player.length !== 2) {
      return NextResponse.json({ error: "cannot_double" }, { status: 400 });
    }
    // Take the extra stake before dealing the double card.
    let balance: number;
    try {
      balance = await adjustBalance(user.id, -state.bet);
    } catch (e) {
      if (e instanceof CoinApiError && e.status === 409) {
        return NextResponse.json(
          { error: "insufficient_balance", coins: e.balance },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "coin_api_error" }, { status: 502 });
    }
    state.doubled = true;
    state.player.push(state.deck.shift()!);
    if (handValue(state.player).total <= 21) {
      playDealer(state);
    }
    state.done = true;
    const { payout, balance: credited, outcome } = await settle(
      user.id,
      state
    );
    return NextResponse.json({
      ...view(state, true),
      token: await signState(state),
      done: true,
      outcome,
      bet: state.bet,
      payout,
      profit: roundCoins(payout - stakeOf(state)),
      balance: credited ?? balance,
    });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
