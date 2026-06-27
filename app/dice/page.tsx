"use client";

import { useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  DICE_MAX_TARGET,
  DICE_MIN_TARGET,
  DICE_DEFAULT_TARGET,
  DEFAULT_BET,
  MAX_BET,
  MIN_BET,
  diceWinChance,
  formatCoins,
  payoutMultiplier,
  roundMultiplier,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface DiceResult {
  result: "win" | "lose";
  target: number;
  roll: number;
  multiplier: number;
  profit: number;
  balance: number;
}

function DiceGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(DEFAULT_BET);
  const [target, setTarget] = useState(DICE_DEFAULT_TARGET);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState(50);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const winChance = diceWinChance(target);
  const multiplier = roundMultiplier(payoutMultiplier(winChance));
  const canPlay = !rolling && coins !== null && coins >= bet;

  async function roll() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setRolling(true);
    const start = performance.now();
    const tick = () => {
      if (performance.now() - start < 600) {
        setDisplay(Math.round(Math.random() * 10000) / 100);
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
    try {
      const res = await fetch("/api/games/dice", {
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
        setRolling(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 650));
      setDisplay(data.roll);
      setResult(data);
      setCoins(data.balance);
      refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setRolling(false);
    }
  }

  const pct = (display / 100) * 100;

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={rolling}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <span className="stake-label">Multiplier</span>
          <div className="stake-input">{multiplier.toFixed(2)}×</div>
        </div>
        <div>
          <span className="stake-label">Win Chance</span>
          <div className="stake-input">{(winChance * 100).toFixed(2)}%</div>
        </div>
      </div>

      <button
        type="button"
        className="stake-btn"
        disabled={!canPlay}
        onClick={roll}
      >
        {rolling ? "Rolling…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <div
        className={cn(
          "text-6xl font-bold tabular-nums transition-colors",
          result
            ? result.result === "win"
              ? "text-[#00e701]"
              : "text-red-400"
            : "text-white"
        )}
      >
        {display.toFixed(2)}
      </div>

      {/* Slider track with roll marker */}
      <div className="w-full max-w-xl">
        <div className="relative h-3 rounded-full bg-red-500/70">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#00e701]"
            style={{ width: `${100 - target}%`, left: `${target}%` }}
          />
          {/* roll marker */}
          <div
            className="absolute -top-1.5 h-6 w-1.5 rounded bg-white shadow"
            style={{ left: `calc(${pct}% - 3px)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-[#5b7283]">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>

        <div className="mt-6">
          <label className="stake-label flex justify-between">
            <span>Roll Over</span>
            <span className="text-white">{target}</span>
          </label>
          <input
            type="range"
            min={DICE_MIN_TARGET}
            max={DICE_MAX_TARGET}
            value={target}
            disabled={rolling}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full accent-[#00e701]"
          />
        </div>
      </div>

      <div className="h-6 text-center">
        {result && (
          <p
            className={cn(
              "text-base font-semibold",
              result.result === "win" ? "text-[#00e701]" : "text-red-400"
            )}
          >
            {result.result === "win"
              ? `Rolled ${result.roll.toFixed(2)} — won +${formatCoins(
                  result.profit
                )} coins!`
              : `Rolled ${result.roll.toFixed(2)} — lost ${formatCoins(
                  Math.abs(result.profit)
                )} coins.`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Dice"
      subtitle="Slide your target and roll over it. Higher target, bigger payout."
      panel={panel}
      board={board}
    />
  );
}

export default function DicePage() {
  return (
    <LoginGate>
      <DiceGame />
    </LoginGate>
  );
}
