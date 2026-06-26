"use client";

import { useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  MAX_BET,
  MIN_BET,
  PLINKO_DEFAULT_ROWS,
  PLINKO_RISKS,
  PLINKO_ROW_OPTIONS,
  PlinkoRisk,
  plinkoMultipliers,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface PlinkoResult {
  result: "win" | "lose";
  bin: number;
  multiplier: number;
  profit: number;
  balance: number;
}

function binColor(m: number): string {
  if (m >= 5) return "#ff003f";
  if (m >= 2) return "#ff7a00";
  if (m >= 1) return "#ffb800";
  return "#00e701";
}

function PlinkoGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [rows, setRows] = useState<number>(PLINKO_DEFAULT_ROWS);
  const [dropping, setDropping] = useState(false);
  const [ball, setBall] = useState<{ row: number; offset: number } | null>(null);
  const [landed, setLanded] = useState<number | null>(null);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const multipliers = plinkoMultipliers(rows, risk);
  const canPlay = !dropping && coins !== null && coins >= bet;

  function animate(bin: number, data: PlinkoResult) {
    // Build a left/right path with exactly `bin` right-moves across `rows` pegs.
    const rights = new Set<number>();
    const idx = Array.from({ length: rows }, (_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    idx.slice(0, bin).forEach((i) => rights.add(i));

    let offset = 0;
    for (let r = 0; r < rows; r++) {
      const dir = rights.has(r) ? 1 : -1;
      const row = r;
      const t = setTimeout(() => {
        offset += dir;
        setBall({ row: row + 1, offset });
      }, r * 130);
      timers.current.push(t);
    }
    const done = setTimeout(() => {
      setLanded(bin);
      setResult(data);
      setCoins(data.balance);
      setDropping(false);
      refresh();
    }, rows * 130 + 200);
    timers.current.push(done);
  }

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setLanded(null);
    setBall({ row: 0, offset: 0 });
    setDropping(true);
    try {
      const res = await fetch("/api/games/plinko", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, risk, rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Not enough coins for that bet.");
          if (typeof data.coins === "number") setCoins(data.coins);
        } else {
          setError("Something went wrong. Try again.");
        }
        setDropping(false);
        return;
      }
      animate(data.bin, data);
    } catch {
      setError("Network error. Try again.");
      setDropping(false);
    }
  }

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={dropping}
      />
      <div className="mb-4">
        <span className="stake-label">Risk</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PLINKO_RISKS.map((r) => (
            <button
              key={r}
              type="button"
              className="stake-chip capitalize"
              data-active={risk === r}
              disabled={dropping}
              onClick={() => setRisk(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <span className="stake-label">Rows</span>
        <div className="grid grid-cols-3 gap-1.5">
          {PLINKO_ROW_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className="stake-chip"
              data-active={rows === r}
              disabled={dropping}
              onClick={() => setRows(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="stake-btn" disabled={!canPlay} onClick={play}>
        {dropping ? "Dropping…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col items-center justify-between gap-4">
      {/* Peg field */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-2 py-2">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex justify-center gap-3">
            {Array.from({ length: r + 2 }, (_, c) => (
              <span
                key={c}
                className="h-1.5 w-1.5 rounded-full bg-[#557086]"
              />
            ))}
          </div>
        ))}
        {ball && (
          <div
            className="absolute h-3 w-3 rounded-full bg-white shadow-[0_0_8px_white] transition-all duration-100"
            style={{
              top: `${(ball.row / (rows + 1)) * 100}%`,
              left: `calc(50% + ${ball.offset * 11}px)`,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* Multiplier bins */}
      <div className="flex w-full justify-center gap-1">
        {multipliers.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded py-1.5 text-center text-[10px] font-bold text-[#07131c] transition-transform",
              landed === i && "scale-110 ring-2 ring-white"
            )}
            style={{ background: binColor(m) }}
          >
            {m}×
          </div>
        ))}
      </div>

      <div className="h-6 text-center">
        {result && (
          <p
            className={cn(
              "text-base font-semibold",
              result.result === "win" ? "text-[#00e701]" : "text-red-400"
            )}
          >
            {result.multiplier}× —{" "}
            {result.profit >= 0
              ? `won +${result.profit} coins!`
              : `lost ${Math.abs(result.profit)} coins.`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Plinko"
      subtitle="Drop the ball, pick your risk. Edge bins pay big, the middle pays small."
      panel={panel}
      board={board}
    />
  );
}

export default function PlinkoPage() {
  return (
    <LoginGate>
      <PlinkoGame />
    </LoginGate>
  );
}
