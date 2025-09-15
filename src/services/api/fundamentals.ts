// src/services/api/fundamentals.ts
// English: fetch compact fundamentals snapshot from your backend's /stable proxy.
// NOTE: This does NOT persist; it's just to inspect and unblock UI quickly.

export type StableSnapshot = {
  income?: unknown[];
  balance?: unknown[];
  cash?: unknown[];
  metrics?: Record<string, unknown> | null;
};

export type SnapshotResult = {
  status: number;
  data: StableSnapshot | null;
};

// English: robust snapshot fetch — try path route first, then query route; log both attempts
export async function fetchFundamentalsSnapshot(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit = 5,
): Promise<SnapshotResult> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { status: 400, data: null };

  const pathUrl = `http://localhost:5046/api/fundamentals/${encodeURIComponent(
    sym,
  )}/snapshot/stable?period=${encodeURIComponent(period)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    console.debug("[snapshot] try path:", pathUrl);
    const resp = await fetch(pathUrl, { headers: { Accept: "application/json" } });

    if (resp.ok) {
      const json = (await resp.json()) as StableSnapshot;
      console.debug("[snapshot] path OK");
      return { status: 200, data: json ?? null };
    }

    console.warn("[snapshot] path failed:", resp.status);
    if (resp.status === 404) {
      const queryUrl = `http://localhost:5046/api/fundamentals/snapshot/stable?symbol=${encodeURIComponent(
        sym,
      )}&period=${encodeURIComponent(period)}&limit=${encodeURIComponent(String(limit))}`;

      console.debug("[snapshot] try query:", queryUrl);
      const resp2 = await fetch(queryUrl, { headers: { Accept: "application/json" } });

      if (resp2.ok) {
        const json2 = (await resp2.json()) as StableSnapshot;
        console.debug("[snapshot] query OK");
        return { status: 200, data: json2 ?? null };
      }

      console.warn("[snapshot] query failed:", resp2.status);
      return { status: resp2.status, data: null };
    }

    return { status: resp.status, data: null };
  } catch (e) {
    console.error("[snapshot] fetch failed:", e);
    return { status: 500, data: null };
  }
}

// English: persist fundamentals (annual/quarter) in DB and return counters
export type FundamentalsRefreshResponse = {
  ok: boolean;
  symbol: string;
  period: "annual" | "quarter";
  years: number;
  // English: how many rows got inserted vs skipped per table
  inserted: { income: number; balance: number; cash: number };
  skipped: { income: number; balance: number; cash: number };
};

export async function refreshFundamentals(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  years = 5,
): Promise<FundamentalsRefreshResponse> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) throw new Error("No symbol");

  const url = `http://localhost:5046/api/fundamentals/refresh?symbol=${encodeURIComponent(
    sym,
  )}&period=${encodeURIComponent(period)}&years=${encodeURIComponent(String(years))}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  // English: surface HTTP code + response text for better debugging
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}${text ? `: ${text}` : ""}`);
  }

  return (await resp.json()) as FundamentalsRefreshResponse;
}

// English: TTM metrics fallback (non-persistent, via backend stable proxy)
export type TtmMetricsResult = {
  status: number;
  data: Record<string, unknown> | null;
};

export async function fetchTtmMetrics(symbol: string): Promise<TtmMetricsResult> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { status: 400, data: null };

  const url = `http://localhost:5046/api/fundamentals/${encodeURIComponent(sym)}/metrics/ttm`;

  try {
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) return { status: resp.status, data: null };

    const json = (await resp.json()) as Record<string, unknown>;
    return { status: 200, data: json ?? null };
  } catch {
    return { status: 500, data: null };
  }
}
