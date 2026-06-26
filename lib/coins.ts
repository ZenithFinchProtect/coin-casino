// Server-side client for the status-coin-bot coin API. The CASINO_API_KEY is
// only ever used here (server side) and never exposed to the browser.

function base(): string {
  return (process.env.BOT_API_BASE || "").replace(/\/$/, "");
}

function headers(): HeadersInit {
  return {
    "X-API-Key": process.env.CASINO_API_KEY || "",
    "Content-Type": "application/json",
  };
}

export class CoinApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public balance?: number
  ) {
    super(message);
    this.name = "CoinApiError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  if (!base()) throw new CoinApiError("coin api not configured", 503);
  const url = `${base()}/api/coins/balance?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new CoinApiError(`balance failed: ${res.status}`, res.status);
  }
  const data = (await res.json()) as { coins: number };
  return data.coins;
}

/**
 * Atomically apply `delta` coins. Throws CoinApiError with status 409 and the
 * current balance when the change would overdraw the account.
 */
export async function adjustBalance(
  userId: string,
  delta: number
): Promise<number> {
  if (!base()) throw new CoinApiError("coin api not configured", 503);
  const res = await fetch(`${base()}/api/coins/adjust`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ user_id: userId, delta }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    coins?: number;
    error?: string;
  };
  if (res.status === 409) {
    throw new CoinApiError("insufficient_balance", 409, data.coins);
  }
  if (!res.ok) {
    throw new CoinApiError(data.error || `adjust failed: ${res.status}`, res.status);
  }
  return data.coins ?? 0;
}
