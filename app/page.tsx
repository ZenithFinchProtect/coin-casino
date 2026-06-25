"use client";

import Link from "next/link";
import { Coins, Bomb, ChevronRight, ShieldAlert, Percent } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { useUser } from "@/components/user-context";
import { MAX_BET, WIN_CHANCE } from "@/lib/games";

const games = [
  {
    href: "/coinflip",
    name: "Coin Flip",
    description: "Call heads or tails. Land it and double your stake.",
    icon: Coins,
  },
  {
    href: "/mines",
    name: "Mines",
    description: "Reveal three safe tiles in a row to triple your stake.",
    icon: Bomb,
  },
];

export default function HomePage() {
  const { user, loading } = useUser();
  const winPct = Math.round(WIN_CHANCE * 100);

  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-center">
            <div className="animate-fade-in mb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                Nordic Casino — Coin Games
              </span>
            </div>

            <h1 className="animate-fade-in text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight max-w-4xl leading-[1.1]">
              Bet your{" "}
              <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Nordic Coins
              </span>
            </h1>

            <p className="animate-fade-in mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Log in with Discord and put the coins you earned with the bot on
              the line. Coin Flip and Mines, ready to play.
            </p>

            <div className="animate-fade-in mt-10 flex flex-col sm:flex-row items-center gap-4">
              {!loading && !user ? (
                <a
                  href="/api/auth/login"
                  className="group flex items-center gap-2 h-12 rounded-xl bg-[#5865F2] px-6 text-sm font-medium text-white shadow-lg shadow-[#5865F2]/25 hover:-translate-y-0.5 transition-all"
                >
                  Login with Discord
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <Link
                  href="/coinflip"
                  className="group flex items-center gap-2 h-12 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all"
                >
                  Start Playing
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Games */}
      <section className="relative">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {games.map((game) => (
              <Link key={game.href} href={game.href} className="glass-card group">
                <div className="relative z-10 p-7">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 mb-4">
                    <game.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5 group-hover:text-primary transition-colors">
                    {game.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {game.description}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    Play now <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* House rules */}
      <section className="relative">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="glass-card-static p-6">
              <Percent className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{winPct}% win chance</h3>
              <p className="text-xs text-muted-foreground">
                Every round is a {winPct}% shot. The house keeps the edge.
              </p>
            </div>
            <div className="glass-card-static p-6">
              <Coins className="h-5 w-5 text-yellow-400 mb-3" />
              <h3 className="font-semibold mb-1">Max bet {MAX_BET} coins</h3>
              <p className="text-xs text-muted-foreground">
                Wager between 1 and {MAX_BET} coins per round.
              </p>
            </div>
            <div className="glass-card-static p-6">
              <ShieldAlert className="h-5 w-5 text-primary mb-3" />
              <h3 className="font-semibold mb-1">Synced with the bot</h3>
              <p className="text-xs text-muted-foreground">
                Balances are the same coins you hold in the Discord bot.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative border-t border-white/5">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8 text-sm text-muted-foreground text-center">
          <p>Nordic Casino — play responsibly. Coins have no real-world value.</p>
        </div>
      </footer>
    </div>
  );
}
