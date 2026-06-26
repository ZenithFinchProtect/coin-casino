"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { CRASH_TARGETS } from "@/lib/games";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "done";

interface CrashRound {
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [mult, setMult] = useState(1);
  const [round, setRound] = useState<CrashRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const canPlay = phase !== "running" && coins !== null && coins >= bet;

  function runRocket(data: CrashRound) {
    // The rocket climbs in real time and stops at the cash-out target on a win
    // or at the crash point on a loss — the server already decided which.
    const stopAt = data.result === "win" ? data.target : data.crashPoint;
    let current = 1;
    setMult(1);
    tickRef.current = setInterval(() => {
      current = Math.round((current + 0.03) * 100) / 100;
      if (current >= stopAt) {
        current = stopAt;
        setMult(current);
        if (tickRef.current) clearInterval(tickRef.current);
        setPhase("done");
        setCoins(data.balance);
        refresh();
        return;
      }
      setMult(current);
    }, 40);
  }

  async function play() {
    if (!canPlay) return;
    setError(null);
    setRound(null);
    setMult(1);
    setPhase("running");
    try {
      const res = await fetch("/api/games/crash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("idle");
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        return;
      }
      setRound(data);
      if (coins !== null) setCoins(coins - bet); // optimistic debit
      runRocket(data);
    } catch {
      setPhase("idle");
      setError("Network error. Try again.");
    }
  }

  const done = phase === "done" && round;
  const crashed = done && round.result === "lose";
  const cashedOut = done && round.result === "win";

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
              "flex h-40 w-40 flex-col items-center justify-center rounded-2xl border-4 transition-colors duration-200",
              phase === "running" && "animate-pulse",
              cashedOut
                ? "border-green-500/60 bg-green-500/10 text-green-400"
                : crashed
                ? "border-red-500/60 bg-red-500/10 text-red-400"
                : "border-primary/60 bg-primary/10 text-primary"
            )}
          >
            <Rocket
              className={cn(
                "h-8 w-8 mb-1",
                phase === "running" && "animate-bounce"
              )}
            />
            <span className="text-3xl font-bold tabular-nums">
              {mult.toFixed(2)}×
            </span>
          </div>

          <div className="h-8 mt-5 text-center">
            {cashedOut && (
              <p className="text-lg font-semibold text-green-400 animate-fade-in">
                Cashed out at {round.target}×! You won +{round.profit} coins!
              </p>
            )}
            {crashed && (
              <p className="text-lg font-semibold text-red-400 animate-fade-in">
                Crashed at {round.crashPoint}×. You lost{" "}
                {Math.abs(round.profit)} coins.
              </p>
            )}
            {phase === "running" && (
              <p className="text-sm text-muted-foreground">
                Climbing to {target}×…
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
                  disabled={phase === "running"}
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

          <BetControls bet={bet} setBet={setBet} disabled={phase === "running"} />

          <button
            type="button"
            onClick={play}
            disabled={!canPlay}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {phase === "running" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Launching…
              </>
            ) : (
              <>
                Launch for {bet} {bet === 1 ? "coin" : "coins"}
              </>
            )}
          </button>

          {coins !== null && coins < bet && phase !== "running" && (
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
