"use client";

import { useState } from "react";
import { Loader2, Spade } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

interface BlackjackResult {
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

function Hand({ label, cards, total }: { label: string; cards: number[]; total: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {label} · {total}
        {total > 21 ? " (bust)" : ""}
      </span>
      <div className="flex gap-1.5">
        {cards.map((c, i) => (
          <div
            key={i}
            className="flex h-16 w-12 items-center justify-center rounded-lg border-2 border-primary/60 bg-primary/10 text-lg font-bold text-primary"
          >
            {cardLabel(c)}
          </div>
        ))}
      </div>
    </div>
  );
}

function BlackjackGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<BlackjackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlay = !playing && coins !== null && coins >= bet;

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setPlaying(true);
    try {
      const res = await fetch("/api/games/blackjack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setPlaying(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 800));
      setResult(data);
      setCoins(data.balance);
      refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPlaying(false);
    }
  }

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
          {result ? (
            <>
              <Hand label="Dealer" cards={result.dealer} total={result.dealerTotal} />
              <Hand label="You" cards={result.player} total={result.playerTotal} />
            </>
          ) : (
            <div className="flex h-32 items-center justify-center text-primary/60">
              <Spade className="h-12 w-12" />
            </div>
          )}

          <div className="h-8 text-center">
            {result && (
              <p
                className={cn(
                  "text-lg font-semibold animate-fade-in",
                  result.result === "win" ? "text-green-400" : "text-red-400"
                )}
              >
                {result.result === "win"
                  ? `You won +${result.profit} coins!`
                  : `You lost ${Math.abs(result.profit)} coins.`}
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <div className="glass-card-static p-6 mt-6 space-y-5">
          <BetControls bet={bet} setBet={setBet} disabled={playing} />

          <button
            type="button"
            onClick={play}
            disabled={!canPlay}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {playing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Dealing…
              </>
            ) : (
              <>
                Deal for {bet} {bet === 1 ? "coin" : "coins"}
              </>
            )}
          </button>

          {coins !== null && coins < bet && (
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
