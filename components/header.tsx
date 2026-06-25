"use client";

import Link from "next/link";
import Image from "next/image";
import { Coins, Dices, LogOut, Spade } from "lucide-react";
import { useUser } from "@/components/user-context";

export function Header() {
  const { user, coins, loading } = useUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-semibold text-lg transition-opacity hover:opacity-80"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Spade className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Nordic Casino</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/coinflip"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
            >
              Coin Flip
            </Link>
            <Link
              href="/mines"
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent"
            >
              Mines
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!loading && user && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-card/60 px-3 py-1.5 text-sm font-semibold">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span>{coins ?? "—"}</span>
            </div>
          )}

          {!loading && user ? (
            <div className="flex items-center gap-2">
              <Image
                src={user.avatar}
                alt={user.username}
                width={28}
                height={28}
                className="rounded-full border border-border"
                unoptimized
              />
              <span className="hidden sm:inline text-sm font-medium">
                {user.username}
              </span>
              <a
                href="/api/auth/logout"
                className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </a>
            </div>
          ) : (
            !loading && (
              <a
                href="/api/auth/login"
                className="flex items-center gap-2 h-9 rounded-lg bg-[#5865F2] px-4 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors"
              >
                <Dices className="h-4 w-4" />
                Login with Discord
              </a>
            )
          )}
        </div>
      </div>
    </header>
  );
}
