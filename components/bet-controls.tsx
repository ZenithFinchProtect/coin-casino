"use client";

import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_BET, MIN_BET } from "@/lib/games";

interface Props {
  bet: number;
  setBet: (bet: number) => void;
  disabled?: boolean;
}

export function BetControls({ bet, setBet, disabled }: Props) {
  const options = [];
  for (let i = MIN_BET; i <= MAX_BET; i++) options.push(i);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          Bet amount
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Coins className="h-4 w-4 text-yellow-400" />
          {bet}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {options.map((amount) => (
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
            {amount}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Max bet is {MAX_BET} coins per round.
      </p>
    </div>
  );
}
