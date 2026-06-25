"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface CasinoUser {
  id: string;
  username: string;
  avatar: string;
}

interface MeState {
  loading: boolean;
  user: CasinoUser | null;
  coins: number | null;
  coinError: string | null;
  refresh: () => Promise<void>;
  setCoins: (coins: number) => void;
}

const UserContext = createContext<MeState | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CasinoUser | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [coinError, setCoinError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        setCoins(null);
        setCoinError(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
      setCoins(typeof data.coins === "number" ? data.coins : null);
      setCoinError(data.coinError ?? null);
    } catch {
      setUser(null);
      setCoins(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <UserContext.Provider
      value={{ loading, user, coins, coinError, refresh, setCoins }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): MeState {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
