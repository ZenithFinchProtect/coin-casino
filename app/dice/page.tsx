"use client";

import { useState } from "react";
import { Dices, Loader2 } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

type Pick = "high" | "low";

interface DiceResult {
  result: "win" | "lose";
  pick: Pick;
  roll: number;
  profit: number;
  balance: number;
}

function DiceGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [pick, setPick] = useState<Pick>("high");
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlay = !rolling && coins !== null && coins >= bet;

  async function roll() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setRolling(true);
    try {
      const res = await fetch("/api/games/dice", {
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
        setRolling(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 1100));
      setResult(data);
      setCoins(data.balance);
      refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setRolling(false);
    }
  }

  const shownRoll = result ? result.roll : null;

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      <div className="relative mx-auto max-w-lg px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-center mb-1">
          Dice
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Low is 1–3, high is 4–6. Win pays 2× your bet.
        </p>

        <div className="glass-card-static p-8 flex flex-col items-center">
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-2xl border-4 text-5xl font-bold transition-transform duration-300",
              rolling && "animate-spin",
              "border-primary/60 bg-primary/10 text-primary"
            )}
          >
            {rolling ? (
              <Dices className="h-12 w-12" />
            ) : shownRoll !== null ? (
              shownRoll
            ) : (
              <Dices className="h-12 w-12 opacity-60" />
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
                  ? `Rolled ${result.roll}. You won +${result.profit} coins!`
                  : `Rolled ${result.roll}. You lost ${Math.abs(
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
              Your call
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(["low", "high"] as Pick[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  disabled={rolling}
                  onClick={() => setPick(side)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-semibold capitalize transition-colors disabled:opacity-50",
                    side === pick
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 hover:bg-accent"
                  )}
                >
                  {side === "low" ? "Low (1–3)" : "High (4–6)"}
                </button>
              ))}
            </div>
          </div>

          <BetControls bet={bet} setBet={setBet} disabled={rolling} />

          <button
            type="button"
            onClick={roll}
            disabled={!canPlay}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {rolling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Rolling…
              </>
            ) : (
              <>Roll for {bet} {bet === 1 ? "coin" : "coins"}</>
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

export default function DicePage() {
  return (
    <LoginGate>
      <DiceGame />
    </LoginGate>
  );
}
