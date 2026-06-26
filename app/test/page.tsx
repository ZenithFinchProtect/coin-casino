"use client";

import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";
import { ParticlesBackground } from "@/components/particles-background";
import { LoginGate } from "@/components/login-gate";
import { testGames } from "@/lib/catalog";

function TestHub() {
  return (
    <div className="relative">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticlesBackground />
      </div>

      <section className="relative">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-4 py-1.5 text-sm font-medium text-yellow-300">
              <FlaskConical className="h-4 w-4" />
              Playtest — staging area
            </span>
            <h1 className="mt-6 text-3xl sm:text-4xl font-bold tracking-tight">
              Experimental games
            </h1>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
              These games aren&apos;t on the main page yet. Try them here with
              your real coin balance, then promote them to live once
              they&apos;re ready.
            </p>
          </div>

          {testGames.length === 0 ? (
            <div className="glass-card-static p-10 max-w-md mx-auto text-center text-sm text-muted-foreground">
              No experimental games right now. New games show up here before
              they go live on the main page.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {testGames.map((game) => (
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
                      Playtest <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default function TestPage() {
  return (
    <LoginGate>
      <TestHub />
    </LoginGate>
  );
}
