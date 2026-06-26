import { Coins, Bomb, Dices } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * "live"  -> shown on the homepage + header nav (in production).
 * "test"  -> only reachable from the hidden /test staging hub. Flip a game to
 *            "live" to "push it to the main page".
 */
export type GameStage = "live" | "test";

export interface GameDef {
  href: string;
  name: string;
  description: string;
  icon: LucideIcon;
  stage: GameStage;
}

export const GAMES: GameDef[] = [
  {
    href: "/coinflip",
    name: "Coin Flip",
    description: "Call heads or tails. Land it and double your stake.",
    icon: Coins,
    stage: "live",
  },
  {
    href: "/mines",
    name: "Mines",
    description: "Reveal three safe tiles in a row to triple your stake.",
    icon: Bomb,
    stage: "live",
  },
  {
    href: "/dice",
    name: "Dice",
    description: "Predict high or low on a six-sided roll to double your stake.",
    icon: Dices,
    stage: "test",
  },
];

export const liveGames = GAMES.filter((g) => g.stage === "live");
export const testGames = GAMES.filter((g) => g.stage === "test");
