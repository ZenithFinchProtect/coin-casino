"use client";

import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_BET, MIN_BET, clampBet, formatCoins } from "@/lib/games";

interface Props {
  bet: number;
  setBet: (bet: number) => void;
  disabled?: boolean;
}

export function BetControls({ bet, setBet, disabled }: Props) {
  // Quick-pick presets, decimals included, clamped to the allowed range.
  const presets = [0.5, 1, 2, 3, MAX_BET].filter(
    (a, i, arr) => a >= MIN_BET && a <= MAX_BET && arr.indexOf(a) === i
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          Bet amount
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Coins className="h-4 w-4 text-yellow-400" />
          {formatCoins(bet)}
        </span>
      </div>
      <input
        type="number"
        value={bet}
        min={MIN_BET}
        max={MAX_BET}
        step={0.01}
        disabled={disabled}
        onChange={(e) => setBet(clampBet(Number(e.target.value)))}
        className="mb-2 h-11 w-full rounded-lg border border-border bg-card/60 px-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="grid grid-cols-5 gap-2">
        {presets.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            onClick={() => setBet(amount)}
            className={cn(
              "h-11 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              amount === bet
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card/60 hover:bg-accent"
            )}
          >
            {formatCoins(amount)}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Bet between {MIN_BET} and {MAX_BET} coins (decimals allowed).
      </p>
    </div>
  );
}
