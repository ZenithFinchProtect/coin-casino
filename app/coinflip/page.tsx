"use client";

import { useState } from "react";
import { Coins, Loader2 } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { BetControls } from "@/components/bet-controls";
import { useUser } from "@/components/user-context";
import { cn } from "@/lib/utils";

type Side = "heads" | "tails";

interface FlipResult {
  result: "win" | "lose";
  landed: Side;
  profit: number;
  balance: number;
}

function CoinFlipGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(1);
  const [choice, setChoice] = useState<Side>("heads");
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<FlipResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPlay = !flipping && coins !== null && coins >= bet;

  async function flip() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setFlipping(true);
    try {
      const res = await fetch("/api/games/coinflip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, choice }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setFlipping(false);
        return;
      }
      // Let the coin spin briefly before revealing.
      await new Promise((r) => setTimeout(r, 1100));
      setResult(data);
      setCoins(data.balance);
      refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setFlipping(false);
    }
  }

  const face: Side = flipping ? "heads" : result ? result.landed : choice;

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      <div className="relative mx-auto max-w-lg px-4 sm:px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-center mb-1">
          Coin Flip
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-8">
          Pick a side. Win pays 2× your bet.
        </p>

        <div className="glass-card-static p-8 flex flex-col items-center">
          <div
            className={cn(
              "flex h-32 w-32 items-center justify-center rounded-full border-4 text-2xl font-bold uppercase tracking-wide transition-transform duration-300",
              flipping && "animate-spin",
              face === "heads"
                ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                : "border-cyan-400/60 bg-cyan-400/10 text-cyan-300"
            )}
          >
            {flipping ? <Coins className="h-10 w-10" /> : face === "heads" ? "H" : "T"}
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
                  : `Landed ${result.landed}. You lost ${Math.abs(
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
              {(["heads", "tails"] as Side[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  disabled={flipping}
                  onClick={() => setChoice(side)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-semibold capitalize transition-colors disabled:opacity-50",
                    side === choice
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/60 hover:bg-accent"
                  )}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>

          <BetControls bet={bet} setBet={setBet} disabled={flipping} />

          <button
            type="button"
            onClick={flip}
            disabled={!canPlay}
            className="flex w-full items-center justify-center gap-2 h-12 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            {flipping ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Flipping…
              </>
            ) : (
              <>Flip for {bet} {bet === 1 ? "coin" : "coins"}</>
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

export default function CoinFlipPage() {
  return (
    <LoginGate>
      <CoinFlipGame />
    </LoginGate>
  );
}
