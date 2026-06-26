"use client";

import { useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import { MAX_BET, MIN_BET } from "@/lib/games";
import { cn } from "@/lib/utils";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

interface Hand {
  player: number[];
  playerTotal: number;
  dealer: number[];
  dealerTotal: number;
  canHit: boolean;
  canDouble: boolean;
  canStand: boolean;
  done: boolean;
  outcome: string | null;
  token: string;
  bet: number;
  payout: number;
  profit?: number;
  balance?: number;
}

const OUTCOME_TEXT: Record<string, string> = {
  player_blackjack: "Blackjack! Pays 3:2",
  player_win: "You win!",
  dealer_bust: "Dealer busts — you win!",
  player_bust: "Bust — you lose.",
  dealer_win: "Dealer wins.",
  push: "Push — bet returned.",
};

function Card({ code, hidden }: { code?: number; hidden?: boolean }) {
  if (hidden || code === undefined) {
    return (
      <div className="flex h-24 w-16 items-center justify-center rounded-lg border-2 border-[#2f4553] bg-[#1a2c38] text-2xl text-[#557086]">
        ?
      </div>
    );
  }
  const rank = RANKS[code % 13];
  const suit = SUITS[Math.floor(code / 13) % 4];
  const red = suit === "♥" || suit === "♦";
  return (
    <div
      className={cn(
        "flex h-24 w-16 flex-col items-center justify-center rounded-lg border-2 border-[#d3dce6] bg-white font-bold",
        red ? "text-red-600" : "text-slate-900"
      )}
    >
      <span className="text-xl">{rank}</span>
      <span className="text-2xl">{suit}</span>
    </div>
  );
}

function BlackjackGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [hand, setHand] = useState<Hand | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inHand = hand !== null && !hand.done;
  const canDeal = !busy && !inHand && coins !== null && coins >= bet;

  async function send(action: string, body: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/games/blackjack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        return null;
      }
      setHand(data);
      if (typeof data.balance === "number") setCoins(data.balance);
      refresh();
      return data as Hand;
    } catch {
      setError("Network error. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const deal = () => send("deal", { bet });
  const hit = () => hand && send("hit", { state: hand.token });
  const stand = () => hand && send("stand", { state: hand.token });
  const double = () => hand && send("double", { state: hand.token });

  const won = hand?.done && (hand.payout ?? 0) > 0;
  const lost = hand?.done && (hand.payout ?? 0) === 0 && hand.outcome !== "push";

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={busy || inHand}
      />
      {!inHand ? (
        <button type="button" className="stake-btn" disabled={!canDeal} onClick={deal}>
          {busy ? "Dealing…" : "Deal"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="stake-btn"
            disabled={busy || !hand?.canHit}
            onClick={hit}
          >
            Hit
          </button>
          <button
            type="button"
            className="stake-btn stake-btn-secondary"
            disabled={busy || !hand?.canStand}
            onClick={stand}
          >
            Stand
          </button>
          <button
            type="button"
            className="stake-btn stake-btn-secondary col-span-2"
            disabled={busy || !hand?.canDouble || coins === null || coins < bet}
            onClick={double}
          >
            Double
          </button>
        </div>
      )}
      <p className="mt-3 text-xs text-[#5b7283]">
        Dealer stands on 17 (hits soft 17). Blackjack pays 3:2.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold text-[#b1bad3]">
          Dealer {hand && (hand.done ? `· ${hand.dealerTotal}` : "")}
        </p>
        <div className="flex gap-2">
          {hand ? (
            hand.dealer.map((c, i) => <Card key={i} code={c} />)
          ) : (
            <Card hidden />
          )}
          {hand && !hand.done && <Card hidden />}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-[#b1bad3]">
          You {hand ? `· ${hand.playerTotal}` : ""}
        </p>
        <div className="flex gap-2">
          {hand ? (
            hand.player.map((c, i) => <Card key={i} code={c} />)
          ) : (
            <>
              <Card hidden />
              <Card hidden />
            </>
          )}
        </div>
      </div>

      <div className="h-6 text-center">
        {hand?.done && hand.outcome && (
          <p
            className={cn(
              "text-base font-semibold",
              won ? "text-[#00e701]" : lost ? "text-red-400" : "text-[#b1bad3]"
            )}
          >
            {OUTCOME_TEXT[hand.outcome] ?? hand.outcome}
            {typeof hand.profit === "number" &&
              ` (${hand.profit >= 0 ? "+" : ""}${hand.profit} coins)`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Blackjack"
      subtitle="Real blackjack — hit, stand, or double. Dealer draws to 17."
      panel={panel}
      board={board}
    />
  );
}

export default function BlackjackPage() {
  return (
    <LoginGate>
      <BlackjackGame />
    </LoginGate>
  );
}
