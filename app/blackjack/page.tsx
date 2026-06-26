"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Spade } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

type Phase = "idle" | "player" | "done";

interface BlackjackRound {
  result: "win" | "lose";
  player: number[];
  dealer: number[];
  playerTotal: number;
  dealerTotal: number;
  profit: number;
  balance: number;
}

function cardLabel(value: number): string {
  if (value === 11) return "A";
  return String(value);
}

function total(cards: number[]): number {
  return cards.reduce((a, b) => a + b, 0);
}

function Hand({
  label,
  cards,
  showTotal,
  hideHole,
}: {
  label: string;
  cards: number[];
  showTotal: boolean;
  hideHole?: boolean;
}) {
  const shownTotal = total(cards);
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {label}
        {showTotal && cards.length > 0 ? ` · ${shownTotal}` : ""}
        {showTotal && shownTotal > 21 ? " (bust)" : ""}
      </span>
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <div
            key={i}
            className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-primary/60 bg-primary/10 text-lg font-bold text-primary animate-fade-in"
          >
            {cardLabel(c)}
          </div>
        ))}
        {hideHole && (
          <div className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-border bg-card/60 text-lg font-bold text-muted-foreground">
            ?
          </div>
        )}
      </div>
    </div>
  );
}

function BlackjackGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [starting, setStarting] = useState(false);
  const [round, setRound] = useState<BlackjackRound | null>(null);
  const [playerShown, setPlayerShown] = useState(0);
  const [dealerShown, setDealerShown] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms));
  }

  const canStart =
    phase !== "player" && !revealing && coins !== null && coins >= bet && !starting;

  async function deal() {
    if (!canStart) return;
    setError(null);
    setOutcome(null);
    setRound(null);
    setPlayerShown(0);
    setDealerShown(0);
    setStarting(true);
    try {
      const res = await fetch("/api/games/blackjack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet }),
      });
      const data: BlackjackRound = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          const c = (data as unknown as { coins?: number }).coins;
          if (typeof c === "number") setCoins(c);
        } else {
          setError("Something went wrong. Try again.");
        }
        setStarting(false);
        return;
      }
      setRound(data);
      setPhase("player");
      if (coins !== null) setCoins(coins - bet); // optimistic debit
      // Deal the player's cards one at a time, plus the dealer's up card.
      data.player.forEach((_, i) => later(() => setPlayerShown(i + 1), 300 * (i + 1)));
      later(() => setDealerShown(1), 300 * (data.player.length + 1));
    } catch {
      setError("Network error. Try again.");
    } finally {
      setStarting(false);
    }
  }

  function stand() {
    if (phase !== "player" || !round || revealing) return;
    setRevealing(true);
    // Flip the dealer's hole card and draw the rest one at a time.
    const remaining = round.dealer.length - 1;
    for (let i = 1; i <= remaining; i++) {
      later(() => setDealerShown(1 + i), 450 * i);
    }
    later(() => {
      setPhase("done");
      setOutcome(round.result);
      setCoins(round.balance);
      setRevealing(false);
      refresh();
    }, 450 * remaining + 500);
  }

  const playerCards = round ? round.player.slice(0, playerShown) : [];
  const dealerCards = round ? round.dealer.slice(0, dealerShown) : [];
  const hideHole = phase === "player" && dealerShown >= 1;

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      <div className="relative mx-auto max-w-lg px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-center mb-1">
          Blackjack
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Beat the dealer without busting. Win pays 2× your bet.
        </p>

        <div className="glass-card-static p-8 flex flex-col items-center gap-6">
          {round ? (
            <>
              <Hand
                label="Dealer"
                cards={dealerCards}
                showTotal={phase === "done"}
                hideHole={hideHole}
              />
              <Hand label="You" cards={playerCards} showTotal />
            </>
          ) : (
            <div className="flex h-32 items-center justify-center text-primary/60">
              <Spade className="h-12 w-12" />
            </div>
          )}

          <div className="h-8 text-center">
            {phase === "done" && outcome && round && (
              <p
                className={cn(
                  "text-lg font-semibold animate-fade-in",
                  outcome === "win" ? "text-green-400" : "text-red-400"
                )}
              >
                {outcome === "win"
                  ? `You won +${round.profit} coins!`
                  : `You lost ${Math.abs(round.profit)} coins.`}
              </p>
            )}
            {phase === "player" && !revealing && (
              <p className="text-sm text-muted-foreground">
                Stand to see the dealer&apos;s hand…
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <div className="glass-card-static p-6 mt-6 space-y-5">
          <BetControls bet={bet} setBet={setBet} disabled={phase === "player"} />

          {phase === "player" ? (
            <button
              type="button"
              onClick={stand}
              disabled={revealing}
              className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {revealing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Revealing…
                </>
              ) : (
                "Stand"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={deal}
              disabled={!canStart}
              className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Dealing…
                </>
              ) : (
                <>
                  Deal for {bet} {bet === 1 ? "coin" : "coins"}
                </>
              )}
            </button>
          )}

          {coins !== null && coins < bet && phase !== "player" && (
            <p className="text-center text-xs text-red-400">
              Not enough coins. Earn more with the Discord bot.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BlackjackPage() {
  return (
    <LoginGate>
      <BlackjackGame />
    </LoginGate>
  );
}
