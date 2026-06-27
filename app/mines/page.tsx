"use client";

import { useState } from "react";
import { Bomb, Gem, Loader2 } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";
import {
  MINES_COUNT,
  MINES_MULTIPLIER,
  MINES_TARGET,
  MINES_TILES,
  formatCoins,
  secureInt,
} from "@/lib/games";

type Phase = "idle" | "playing" | "done";
type Tile = "gem" | "bomb";

interface Round {
  result: "win" | "lose";
  bustStep: number | null;
  target: number;
  multiplier: number;
  payout: number;
  profit: number;
  balance: number;
}

function MinesGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [starting, setStarting] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const [revealed, setRevealed] = useState<Record<number, Tile>>({});
  const [picks, setPicks] = useState(0);
  const [outcome, setOutcome] = useState<"win" | "lose" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canStart = phase !== "playing" && coins !== null && coins >= bet && !starting;

  async function startRound() {
    if (!canStart) return;
    setError(null);
    setOutcome(null);
    setRevealed({});
    setPicks(0);
    setStarting(true);
    try {
      const res = await fetch("/api/games/mines", {
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

  function finalize(r: Round, won: "win" | "lose") {
    setPhase("done");
    setOutcome(won);
    setCoins(r.balance);
    refresh();
  }

  function revealExtraBombs(exclude: number) {
    const extra: Record<number, Tile> = {};
    let placed = 0;
    let guard = 0;
    while (placed < MINES_COUNT - 1 && guard < 200) {
      guard++;
      const idx = secureInt(MINES_TILES);
      if (idx === exclude || extra[idx] || revealed[idx]) continue;
      extra[idx] = "bomb";
      placed++;
    }
    setRevealed((prev) => ({ ...prev, ...extra }));
  }

  function clickTile(index: number) {
    if (phase !== "playing" || !round || revealed[index]) return;
    const step = picks + 1;

    if (round.result === "lose" && step === round.bustStep) {
      setRevealed((prev) => ({ ...prev, [index]: "bomb" }));
      revealExtraBombs(index);
      finalize(round, "lose");
      return;
    }

    const nextPicks = step;
    setRevealed((prev) => ({ ...prev, [index]: "gem" }));
    setPicks(nextPicks);

    if (nextPicks >= round.target) {
      finalize(round, "win");
    }
  }

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      <div className="relative mx-auto max-w-lg px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-center mb-1">
          Mines
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Reveal {MINES_TARGET} safe tiles in a row to win {MINES_MULTIPLIER}× your
          bet. One mine ends the round.
        </p>

        <div className="glass-card-static p-6">
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="text-muted-foreground">
              Safe picks:{" "}
              <span className="font-semibold text-foreground">
                {picks}/{MINES_TARGET}
              </span>
            </span>
            <span className="text-muted-foreground">
              {MINES_COUNT} mines hidden
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: MINES_TILES }).map((_, i) => {
              const tile = revealed[i];
              return (
                <button
                  key={i}
                  type="button"
                  disabled={phase !== "playing" || !!tile}
                  onClick={() => clickTile(i)}
                  className={cn(
                    "aspect-square rounded-lg border flex items-center justify-center transition-all",
                    !tile &&
                      phase === "playing" &&
                      "border-primary/30 bg-card/60 hover:bg-primary/10 hover:border-primary/60 cursor-pointer",
                    !tile && phase !== "playing" && "border-border bg-card/40",
                    tile === "gem" && "border-green-400/50 bg-green-400/10",
                    tile === "bomb" && "border-red-500/50 bg-red-500/15"
                  )}
                >
                  {tile === "gem" && <Gem className="h-5 w-5 text-green-400" />}
                  {tile === "bomb" && <Bomb className="h-5 w-5 text-red-500" />}
                </button>
              );
            })}
          </div>

          <div className="h-7 mt-4 text-center">
            {phase === "done" && outcome === "win" && round && (
              <p className="text-lg font-semibold text-green-400 animate-fade-in">
                Cleared! You won +{formatCoins(round.profit)} coins.
              </p>
            )}
            {phase === "done" && outcome === "lose" && round && (
              <p className="text-lg font-semibold text-red-400 animate-fade-in">
                Boom! You lost {formatCoins(Math.abs(round.profit))} coins.
              </p>
            )}
            {phase === "playing" && (
              <p className="text-sm text-muted-foreground">
                Pick a tile…
              </p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        </div>

        <div className="glass-card-static p-6 mt-6 space-y-5">
          <BetControls bet={bet} setBet={setBet} disabled={phase === "playing"} />

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
            ) : phase === "playing" ? (
              "Round in progress…"
            ) : (
              <>
                Play for {formatCoins(bet)} {bet === 1 ? "coin" : "coins"}
              </>
            )}
          </button>

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

export default function MinesPage() {
  return (
    <LoginGate>
      <MinesGame />
    </LoginGate>
  );
}
