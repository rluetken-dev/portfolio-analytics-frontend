// src/services/api/quotes.ts
import type { LatestMetricWithStatus } from "../../types/analytics";

export async function getLatestCloseFromQuotes(symbol: string): Promise<LatestMetricWithStatus> {
  // English: normalize symbol
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) {
    // treat as bad request on empty symbol
    return { symbol: sym, value: null, unit: "USD", status: 400 };
  }

  try {
    // Call backend directly (bypass Vite proxy during dev)
    const url = `http://localhost:5046/api/quotes/latest?symbol=${encodeURIComponent(sym)}&take=1`;

    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      // Surface HTTP error code to UI
      return { symbol: sym, value: null, unit: "USD", status: resp.status };
    }

    const rows = (await resp.json()) as unknown;

    if (!Array.isArray(rows) || rows.length === 0) {
      // No cached rows → behave like 404
      return { symbol: sym, value: null, unit: "USD", status: 404 };
    }

    const r = rows[0] as {
      date?: string;
      close?: number;
      adjustedClose?: number;
      source?: string;
    };

    const hasAdj = typeof r.adjustedClose === "number";
    const val = hasAdj
      ? (r.adjustedClose as number)
      : typeof r.close === "number"
        ? (r.close as number)
        : null;

    return {
      symbol: sym,
      value: val,
      asOf: r.date,
      adjusted: hasAdj,
      source: r.source,
      unit: "USD",
      status: 200, // success
    };
  } catch (err) {
    console.error("[quotes] getLatestCloseFromQuotes failed:", err);
    // Network/parse error → generic 500
    return { symbol: sym, value: null, unit: "USD", status: 500 };
  }
}

// English: fetch & persist recent quotes for one or more symbols, then return stats
type RefreshResponse = {
  ok: boolean;
  symbols: string[];
  inserted: number;
  skipped: number;
};

export async function refreshQuotes(symbols: string, range = "24m"): Promise<RefreshResponse> {
  const list = (symbols ?? "").trim();
  if (!list) throw new Error("No symbols");

  const url = `http://localhost:5046/api/quotes/refresh?symbols=${encodeURIComponent(
    list,
  )}&range=${encodeURIComponent(range)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  return (await resp.json()) as RefreshResponse;
}

// English: fetch the most recent live price (does NOT persist to DB)
export type CurrentQuote = {
  symbol: string;
  price: number | null;
  latestTradingDay?: string;
  status: number;
};

export async function getCurrentPrice(symbol: string): Promise<CurrentQuote> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { symbol: sym, price: null, status: 400 };

  try {
    const url = `http://localhost:5046/api/quotes/current?symbol=${encodeURIComponent(sym)}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });

    if (!resp.ok) {
      // English: surface HTTP code for UI hinting
      return { symbol: sym, price: null, status: resp.status };
    }

    const data = (await resp.json()) as {
      symbol?: string;
      price?: number;
      latestTradingDay?: string;
    };

    return {
      symbol: data.symbol ?? sym,
      price: typeof data.price === "number" ? data.price : null,
      latestTradingDay: data.latestTradingDay,
      status: 200,
    };
  } catch {
    // English: network/parse error
    return { symbol: sym, price: null, status: 500 };
  }
}
