"use client";

import { useState } from "react";
import { Bird, Loader2, Car } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

interface MissionResult {
  result: "win" | "lose";
  lanes: number;
  bustLane: number | null;
  profit: number;
  balance: number;
}

function MissionGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<MissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lanes = result?.lanes ?? 5;
  const canPlay = !playing && coins !== null && coins >= bet;

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setPlaying(true);
    try {
      const res = await fetch("/api/games/mission", {
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
          Mission Uncrossable
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Cross all {lanes} lanes of traffic. Complete the run to triple your bet.
        </p>

        <div className="glass-card-static p-8">
          <div className="flex items-stretch gap-1.5">
            {Array.from({ length: lanes }).map((_, i) => {
              const laneNo = i + 1;
              const busted = result && result.bustLane === laneNo;
              const crossed =
                result &&
                (result.result === "win" ||
                  (result.bustLane !== null && laneNo < result.bustLane));
              return (
                <div
                  key={i}
                  className={cn(
                    "flex h-28 flex-1 flex-col items-center justify-center rounded-lg border text-xs",
                    busted
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : crossed
                      ? "border-green-500/60 bg-green-500/10 text-green-400"
                      : "border-border bg-card/60 text-muted-foreground"
                  )}
                >
                  {busted ? (
                    <Car className="h-6 w-6" />
                  ) : crossed ? (
                    <Bird className="h-6 w-6" />
                  ) : (
                    <span>{laneNo}</span>
                  )}
                </div>
              );
            })}
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
                  ? `Made it across! You won +${result.profit} coins!`
                  : `Hit in lane ${result.bustLane}. You lost ${Math.abs(
                      result.profit
                    )} coins.`}
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
                <Loader2 className="h-4 w-4 animate-spin" /> Crossing…
              </>
            ) : (
              <>
                Run for {bet} {bet === 1 ? "coin" : "coins"}
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

export default function MissionPage() {
  return (
    <LoginGate>
      <MissionGame />
    </LoginGate>
  );
}
