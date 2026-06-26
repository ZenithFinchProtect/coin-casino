"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Loader2, HelpCircle } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

type Pick = "higher" | "lower";

interface HiLoResult {
  result: "win" | "lose";
  pick: Pick;
  current: number;
  next: number;
  profit: number;
  balance: number;
}

const RANK_LABELS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

function Card({ rank, hidden }: { rank: number | null; hidden?: boolean }) {
  return (
    <div className="flex h-32 w-24 items-center justify-center rounded-2xl border-4 border-primary/60 bg-primary/10 text-4xl font-bold text-primary">
      {hidden || rank === null ? (
        <HelpCircle className="h-10 w-10 opacity-60" />
      ) : (
        rankLabel(rank)
      )}
    </div>
  );
}

function HighLowGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [pick, setPick] = useState<Pick>("higher");
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<HiLoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlay = !playing && coins !== null && coins >= bet;

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setPlaying(true);
    try {
      const res = await fetch("/api/games/highlow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, pick }),
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
          High / Low
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Guess if the next card is higher or lower. Win pays 2× your bet.
        </p>

        <div className="glass-card-static p-8 flex flex-col items-center">
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Current</span>
              <Card rank={result ? result.current : 7} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">Next</span>
              <Card rank={result ? result.next : null} hidden={!result} />
            </div>
          </div>

          <div className="h-8 mt-5 text-center">
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
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Your call
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(["lower", "higher"] as Pick[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  disabled={playing}
                  onClick={() => setPick(side)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold capitalize transition-colors disabled:opacity-50",
                    side === pick
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 hover:bg-accent"
                  )}
                >
                  {side === "higher" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  {side}
                </button>
              ))}
            </div>
          </div>

          <BetControls bet={bet} setBet={setBet} disabled={playing} />

          <button
            type="button"
            onClick={play}
            disabled={!canPlay}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {playing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Drawing…
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

export default function HighLowPage() {
  return (
    <LoginGate>
      <HighLowGame />
    </LoginGate>
  );
}
