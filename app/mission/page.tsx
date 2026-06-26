"use client";

import { useState } from "react";
import { Bird, Loader2, Car } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { MISSION_LANES, MISSION_MULTIPLIER } from "@/lib/games";
import { cn } from "@/lib/utils";

type Phase = "idle" | "playing" | "done";

interface MissionRound {
  result: "win" | "lose";
  lanes: number;
  bustLane: number | null;
  profit: number;
  balance: number;
}

function MissionGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [starting, setStarting] = useState(false);
  const [round, setRound] = useState<MissionRound | null>(null);
  const [crossed, setCrossed] = useState(0);
  const [bustedLane, setBustedLane] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lanes = round?.lanes ?? MISSION_LANES;
  const canStart =
    phase !== "playing" && coins !== null && coins >= bet && !starting;

  async function startRound() {
    if (!canStart) return;
    setError(null);
    setOutcome(null);
    setCrossed(0);
    setBustedLane(null);
    setStarting(true);
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
        setStarting(false);
        return;
      }
      setRound(data);
      setPhase("playing");
      if (coins !== null) setCoins(coins - bet); // optimistic debit
    } catch {
      setError("Network error. Try again.");
    } finally {
      setStarting(false);
    }
  }

  function finalize(r: MissionRound, won: "win" | "lose") {
    setPhase("done");
    setOutcome(won);
    setCoins(r.balance);
    refresh();
  }

  function advance() {
    if (phase !== "playing" || !round) return;
    const step = crossed + 1; // the lane we're stepping into (1-based)

    if (round.result === "lose" && step === round.bustLane) {
      setBustedLane(step);
      finalize(round, "lose");
      return;
    }

    setCrossed(step);
    if (step >= round.lanes) {
      finalize(round, "win");
    }
  }

  const advanceLabel =
    phase === "playing"
      ? crossed + 1 >= lanes
        ? "Cross the final lane"
        : "Advance to next lane"
      : null;

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

        <div className="glass-card-static p-6">
          {phase !== "idle" && (
            <div className="flex items-center justify-between mb-4 text-sm">
              <span className="text-muted-foreground">
                Lanes crossed:{" "}
                <span className="font-semibold text-foreground">
                  {crossed}/{lanes}
                </span>
              </span>
              <span className="text-muted-foreground">
                {MISSION_MULTIPLIER}× on a full run
              </span>
            </div>
          )}

          <div className="flex items-stretch gap-1.5">
            {Array.from({ length: lanes }).map((_, i) => {
              const laneNo = i + 1;
              const busted = bustedLane === laneNo;
              const isCrossed = laneNo <= crossed;
              const isNext = phase === "playing" && laneNo === crossed + 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex h-28 flex-1 flex-col items-center justify-center rounded-lg border text-xs transition-all",
                    busted
                      ? "border-red-500/60 bg-red-500/10 text-red-400"
                      : isCrossed
                      ? "border-green-500/60 bg-green-500/10 text-green-400"
                      : isNext
                      ? "border-primary/60 bg-primary/10 text-primary animate-pulse"
                      : "border-border bg-card/60 text-muted-foreground"
                  )}
                >
                  {busted ? (
                    <Car className="h-6 w-6" />
                  ) : isCrossed ? (
                    <Bird className="h-6 w-6" />
                  ) : (
                    <span>{laneNo}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-8 mt-5 text-center">
            {phase === "done" && outcome === "win" && round && (
              <p className="text-lg font-semibold text-green-400 animate-fade-in">
                Made it across! You won +{round.profit} coins!
              </p>
            )}
            {phase === "done" && outcome === "lose" && round && (
              <p className="text-lg font-semibold text-red-400 animate-fade-in">
                Hit in lane {round.bustLane}. You lost{" "}
                {Math.abs(round.profit)} coins.
              </p>
            )}
            {phase === "playing" && (
              <p className="text-sm text-muted-foreground">
                Tap advance to cross the next lane…
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <div className="glass-card-static p-6 mt-6 space-y-5">
          <BetControls bet={bet} setBet={setBet} disabled={phase === "playing"} />

          {phase === "playing" ? (
            <button
              type="button"
              onClick={advance}
              className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
            >
              {advanceLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRound}
              disabled={!canStart}
              className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Starting…
                </>
              ) : (
                <>
                  Run for {bet} {bet === 1 ? "coin" : "coins"}
                </>
              )}
            </button>
          )}

          {coins !== null && coins < bet && phase !== "playing" && (
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
