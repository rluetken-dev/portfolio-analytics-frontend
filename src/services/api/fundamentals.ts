// src/services/api/fundamentals.ts

// English: feature flag to disable the temporary ingest fallback
const FALLBACK_ENABLED = false; // set to true only if backend refresh is stubbed

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

// English: shape of ingest endpoint responses (loose but typed)
type IngestResponse = {
  inserted?: number;
  skipped?: number;
  upserts?: number;
};

// English: tiny helper to hit ingest endpoints sequentially (income -> balance -> cash)
async function ingestFallback(
  symbol: string,
  period: "annual" | "quarter",
  years: number,
): Promise<{
  inserted: { income: number; balance: number; cash: number };
  skipped: { income: number; balance: number; cash: number };
}> {
  const limit = Math.max(1, years);

  async function hit(path: string) {
    const url = `http://localhost:5046${path}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} on ${path}`);

    const j: IngestResponse = await resp.json();

    // English: normalize counters defensively
    const inserted = Number(j.inserted ?? j.upserts ?? 0) || 0;
    const skipped = Number(j.skipped ?? 0) || 0;
    return { inserted, skipped };
  }

  const inc = await hit(
    `/api/ingest/income/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}&limit=${limit}`,
  );
  const bal = await hit(
    `/api/ingest/balance/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}&limit=${limit}`,
  );
  const cas = await hit(
    `/api/ingest/cash/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}&limit=${limit}`,
  );

  return {
    inserted: { income: inc.inserted, balance: bal.inserted, cash: cas.inserted },
    skipped: { income: inc.skipped, balance: bal.skipped, cash: cas.skipped },
  };
}

/**
 * Persist fundamentals (Income/Balance/Cash) for a symbol.
 * POST /api/fundamentals/refresh?symbol=&period=&years=
 */
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

  // English: on HTTP error, throw with body text
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}${text ? `: ${text}` : ""}`);
  }

  const base = (await resp.json()) as FundamentalsRefreshResponse;

  // English: only use fallback if explicitly enabled
  if (FALLBACK_ENABLED) {
    const allZero =
      (base.inserted?.income ?? 0) === 0 &&
      (base.inserted?.balance ?? 0) === 0 &&
      (base.inserted?.cash ?? 0) === 0 &&
      (base.skipped?.income ?? 0) === 0 &&
      (base.skipped?.balance ?? 0) === 0 &&
      (base.skipped?.cash ?? 0) === 0;

    if (allZero) {
      const f = await ingestFallback(sym, period, years);
      return {
        ok: true,
        symbol: sym,
        period,
        years,
        inserted: f.inserted,
        skipped: f.skipped,
      };
    }
  }

  return base;
}
