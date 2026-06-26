"use client";

import { useState } from "react";
import { LoginGate } from "@/components/login-gate";
import { useUser } from "@/components/user-context";
import { StakeShell, StakeBetField } from "@/components/stake-shell";
import {
  MAX_BET,
  MIN_BET,
  MISSION_DEFAULT_LANES,
  MISSION_MAX_LANES,
  missionMultiplier,
  missionWinChance,
} from "@/lib/games";
import { cn } from "@/lib/utils";

interface MissionResult {
  result: "win" | "lose";
  lanes: number;
  bustLane: number | null;
  profit: number;
  balance: number;
}

function MissionGame() {
  const { coins, setCoins, refresh } = useUser();
  const [bet, setBet] = useState(MIN_BET);
  const [lanes, setLanes] = useState(MISSION_DEFAULT_LANES);
  const [running, setRunning] = useState(false);
  const [pos, setPos] = useState(0); // current lane reached (0 = start)
  const [result, setResult] = useState<MissionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const multiplier = missionMultiplier(lanes);
  const winChance = missionWinChance(lanes);
  const canPlay = !running && coins !== null && coins >= bet;

  function walk(target: number, bustLane: number | null, data: MissionResult) {
    let lane = 0;
    const stopAt = bustLane ?? target;
    const id = setInterval(() => {
      lane += 1;
      setPos(lane);
      if (lane >= stopAt) {
        clearInterval(id);
        setTimeout(() => {
          setResult(data);
          setCoins(data.balance);
          setRunning(false);
          refresh();
        }, 300);
      }
    }, 380);
  }

  async function play() {
    if (!canPlay) return;
    setError(null);
    setResult(null);
    setPos(0);
    setRunning(true);
    try {
      const res = await fetch("/api/games/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bet, lanes }),
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
      walk(data.lanes, data.bustLane, data);
    } catch {
      setError("Network error. Try again.");
      setRunning(false);
    }
  }

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
        <label className="stake-label flex justify-between">
          <span>Lanes to cross</span>
          <span className="text-white">{lanes}</span>
        </label>
        <input
          type="range"
          min={1}
          max={MISSION_MAX_LANES}
          value={lanes}
          disabled={running}
          onChange={(e) => setLanes(Number(e.target.value))}
          className="w-full accent-[#00e701]"
        />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <span className="stake-label">Cashout</span>
          <div className="stake-input">{multiplier.toFixed(2)}×</div>
        </div>
        <div>
          <span className="stake-label">Win Chance</span>
          <div className="stake-input">{(winChance * 100).toFixed(1)}%</div>
        </div>
      </div>
      <button type="button" className="stake-btn" disabled={!canPlay} onClick={play}>
        {running ? "Crossing…" : "Bet"}
      </button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </>
  );

  const board = (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {Array.from({ length: MISSION_MAX_LANES }, (_, i) => i + 1).map((lane) => {
          const target = lane <= lanes;
          const reached = pos >= lane;
          const isBust =
            result?.result === "lose" && result.bustLane === lane;
          const here = running && pos === lane;
          return (
            <div
              key={lane}
              className={cn(
                "flex h-44 min-w-[52px] flex-1 flex-col items-center justify-center rounded-lg border text-2xl transition-colors",
                isBust
                  ? "border-red-500 bg-red-500/15"
                  : reached && target
                    ? "border-[#00e701] bg-[#00e701]/10"
                    : target
                      ? "border-[#2f4553] bg-[#0f212e]"
                      : "border-transparent bg-[#0b1922]/60 opacity-50"
              )}
            >
              <span className={cn(here && "animate-bounce")}>
                {isBust ? "💥" : here ? "🐤" : reached && target ? "🐤" : ""}
              </span>
              <span className="mt-2 text-[10px] font-semibold text-[#5b7283]">
                {target ? `L${lane}` : ""}
              </span>
            </div>
          );
        })}
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
              ? `Crossed all ${result.lanes} lanes — won +${result.profit} coins!`
              : `Hit on lane ${result.bustLane} — lost ${Math.abs(
                  result.profit
                )} coins.`}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <StakeShell
      title="Mission"
      subtitle="Pick how many lanes to cross. The further you go, the bigger the payout."
      panel={panel}
      board={board}
    />
  );
}

export default function MissionPage() {
  return (
    <LoginGate>
      <MissionGame />
    </LoginGate>
  );
}
