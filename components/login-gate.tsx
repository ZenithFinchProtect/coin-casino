"use client";

import { Dices, Loader2 } from "lucide-react";
import { useUser } from "@/components/user-context";

/** Renders children only when logged in; otherwise shows a Discord login prompt. */
export function LoginGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="glass-card-static p-8">
          <h2 className="text-xl font-semibold mb-2">Login required</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Sign in with Discord to play and use your coin balance.
          </p>
          <a
            href="/api/auth/login"
            className="inline-flex items-center gap-2 h-11 rounded-xl bg-[#5865F2] px-6 text-sm font-medium text-white hover:bg-[#4752c4] transition-colors"
          >
            <Dices className="h-4 w-4" />
            Login with Discord
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
