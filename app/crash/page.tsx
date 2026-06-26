"use client";

import { useRef, useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  CRASH_DEFAULT_TARGET,
  CRASH_MAX_TARGET,
  CRASH_MIN_TARGET,
  MAX_BET,
  MIN_BET,
  crashWinChanceContinuous,
  payoutMultiplier,
  roundMultiplier,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface CrashResult {
  result: "win" | "lose";
  target: number;
  crashPoint: number;
  profit: number;
  balance: number;
}

function CrashGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [targetText, setTargetText] = useState(CRASH_DEFAULT_TARGET.toFixed(2));
  const [running, setRunning] = useState(false);
  const [multi, setMulti] = useState(1);
  const [result, setResult] = useState<CrashResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  const clampTarget = (n: number) =>
    Math.max(CRASH_MIN_TARGET, Math.min(CRASH_MAX_TARGET, n));
  const parsed = Number(targetText);
  const target = clampTarget(Number.isFinite(parsed) && parsed > 0 ? parsed : CRASH_MIN_TARGET);

  const winChance = crashWinChanceContinuous(target);
  const potential = roundMultiplier(payoutMultiplier(winChance));
  const canPlay = !running && coins !== null && coins >= bet;

  function animateTo(end: number, data: CrashResult) {
    const start = performance.now();
    const duration = 400 + Math.min(end, 10) * 250;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const value = 1 + (end - 1) * t;
      setMulti(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setMulti(end);
        setResult(data);
        setCoins(data.balance);
        setRunning(false);
        refresh();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setRunning(true);
    setMulti(1);
    try {
      const res = await fetch("/api/games/crash", {
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
        setRunning(false);
        return;
      }
      const end = data.result === "win" ? data.target : data.crashPoint;
      animateTo(end, data);
    } catch {
      setError("Network error. Try again.");
      setRunning(false);
    }
  }

  const busted = result?.result === "lose";
  const won = result?.result === "win";

  const panel = (
    <>
      <StakeBetField
        bet={bet}
        setBet={setBet}
        min={MIN_BET}
        max={MAX_BET}
        disabled={running}
      />

      <div className="mb-4">
        <span className="stake-label">Auto Cashout</span>
        <input
          type="number"
          className="stake-input"
          step={0.01}
          min={CRASH_MIN_TARGET}
          max={CRASH_MAX_TARGET}
          value={targetText}
          disabled={running}
          onChange={(e) => setTargetText(e.target.value)}
          onBlur={() => setTargetText(clampTarget(parsed > 0 ? parsed : CRASH_MIN_TARGET).toFixed(2))}
        />
        <p className="mt-1.5 text-xs text-[#5b7283]">
          Pays {potential.toFixed(2)}× • win chance {(winChance * 100).toFixed(1)}%
        </p>
      </div>

      <button type="button" className="stake-btn" disabled={!canPlay} onClick={play}>
        {running ? "Flying…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div
        className={cn(
          "text-7xl font-bold tabular-nums transition-colors",
          busted ? "text-red-500" : won ? "text-[#00e701]" : "text-white"
        )}
      >
        {multi.toFixed(2)}×
      </div>
      <div className="mt-6 h-6 text-center">
        {won && (
          <p className="text-base font-semibold text-[#00e701]">
            Cashed out at {result.target.toFixed(2)}× — won +{result.profit} coins!
          </p>
        )}
        {busted && (
          <p className="text-base font-semibold text-red-400">
            Crashed at {result.crashPoint.toFixed(2)}× — lost{" "}
            {Math.abs(result.profit)} coins.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Crash"
      subtitle="Set your auto-cashout and ride the rocket before it busts."
      panel={panel}
      board={board}
    />
  );
}

export default function CrashPage() {
  return (
    <LoginGate>
      <CrashGame />
    </LoginGate>
  );
}
