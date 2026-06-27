"use client";

import { ReactNode } from "react";
import { Coins } from "lucide-react";
import { useUser } from "@/components/user-context";

interface Props {
  title: string;
  subtitle?: string;
  /** Left column: bet amount, controls, the play button. */
  panel: ReactNode;
  /** Right column: the live game board / animation. */
  board: ReactNode;
}

/**
 * Stake-style two-column game layout: a dark bet panel on the left and the
 * game board on the right, on a navy background.
 */
export function StakeShell({ title, subtitle, panel, board }: Props) {
  const { coins } = useUser();
  return (
    <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[#b1bad3] mt-0.5">{subtitle}</p>
          )}
        </div>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Coins className="h-4 w-4 text-yellow-400" />
          {coins === null
            ? "—"
            : coins.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
        </span>
      </div>

      <div className="stake-shell">
        <div className="stake-panel">{panel}</div>
        <div className="stake-board">{board}</div>
      </div>
    </div>
  );
}

interface BetFieldProps {
  bet: number;
  setBet: (n: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}

/** Stake-style bet amount field with ½ / 2× quick buttons. */
export function StakeBetField({
  bet,
  setBet,
  min,
  max,
  disabled,
}: BetFieldProps) {
  // Snap to whole cents so bets stay valid (matches isValidBet on the server).
  const clamp = (n: number) =>
    Math.max(min, Math.min(max, Math.round(n * 100) / 100));
  return (
    <div className="mb-4">
      <span className="stake-label">Bet Amount</span>
      <div className="flex gap-1.5">
        <input
          type="number"
          className="stake-input"
          value={bet}
          min={min}
          max={max}
          step={0.01}
          disabled={disabled}
          onChange={(e) => setBet(clamp(Number(e.target.value) || min))}
        />
        <button
          type="button"
          disabled={disabled}
          className="stake-chip px-3"
          onClick={() => setBet(clamp(bet / 2))}
        >
          ½
        </button>
        <button
          type="button"
          disabled={disabled}
          className="stake-chip px-3"
          onClick={() => setBet(clamp(bet * 2))}
        >
          2×
        </button>
      </div>
      <p className="mt-1.5 text-xs text-[#5b7283]">
        Bet between {min} and {max} coins (decimals allowed).
      </p>
    </div>
  );
}
