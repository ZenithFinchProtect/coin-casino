"use client";

import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { CRASH_TARGETS } from "@/lib/games";
import { cn } from "@/lib/utils";

interface CrashResult {
  result: "win" | "lose";
  target: number;
  crashPoint: number;
  profit: number;
  balance: number;
}

function CrashGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [target, setTarget] = useState<number>(CRASH_TARGETS[0]);
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlay = !playing && coins !== null && coins >= bet;

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setPlaying(true);
    try {
      const res = await fetch("/api/games/crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, target }),
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
      await new Promise((r) => setTimeout(r, 900));
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
          Crash
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Auto cash-out at your target before the rocket crashes.
        </p>

        <div className="glass-card-static p-8 flex flex-col items-center">
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-2xl border-4 transition-transform duration-300",
              playing && "animate-bounce",
              result
                ? result.result === "win"
                  ? "border-green-500/60 bg-green-500/10 text-green-400"
                  : "border-red-500/60 bg-red-500/10 text-red-400"
                : "border-primary/60 bg-primary/10 text-primary"
            )}
          >
            {result ? (
              <span className="text-2xl font-bold">{result.crashPoint}×</span>
            ) : (
              <Rocket className="h-12 w-12" />
            )}
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
                  ? `Cashed out at ${result.target}×! You won +${result.profit} coins!`
                  : `Crashed at ${result.crashPoint}×. You lost ${Math.abs(
                      result.profit
                    )} coins.`}
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <div className="glass-card-static p-6 mt-6 space-y-5">
          <div>
            <span className="text-sm font-medium text-muted-foreground">
              Cash-out target
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {CRASH_TARGETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={playing}
                  onClick={() => setTarget(t)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50",
                    t === target
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 hover:bg-accent"
                  )}
                >
                  {t}×
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
                <Loader2 className="h-4 w-4 animate-spin" /> Launching…
              </>
            ) : (
              <>
                Launch for {bet} {bet === 1 ? "coin" : "coins"}
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

export default function CrashPage() {
  return (
    <LoginGate>
      <CrashGame />
    </LoginGate>
  );
}
