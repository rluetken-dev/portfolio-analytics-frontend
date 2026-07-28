// src/services/api/quotes.ts
import type { LatestMetricWithStatus } from "../../types/analytics";

type QuoteRow = {
  date?: string;
  close?: number;
  adjustedClose?: number;
  source?: string;
};

export async function getLatestCloseFromQuotes(symbol: string): Promise<LatestMetricWithStatus> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) {
    return {
      symbol: sym,
      value: null,
      unit: "USD",
      status: 400,
      error: "Symbol required",
      retryAfterSec: undefined,
    };
  }

  try {
    const url = `/api/quotes/latest?symbol=${encodeURIComponent(sym)}&take=1`;
    const resp = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });

    if (!resp.ok) {
      // Special handling for 429
      if (resp.status === 429) {
        const err = await resp.json();
        const retryAfterHeader = resp.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

        return {
          symbol: sym,
          value: null,
          unit: "USD",
          status: 429,
          error: err.detail || "Rate limit reached – please try again later",
          retryAfterSec,
        };
      }

      // Generic error case
      return {
        symbol: sym,
        value: null,
        unit: "USD",
        status: resp.status,
        retryAfterSec: undefined,
      };
    }

    const rows = (await resp.json()) as QuoteRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return { symbol: sym, value: null, unit: "USD", status: 404, retryAfterSec: undefined };
    }

    const r = rows[0];
    const hasAdj = typeof r.adjustedClose === "number";
    const val: number | null = hasAdj
      ? r.adjustedClose!
      : typeof r.close === "number"
        ? r.close!
        : null;

    return {
      symbol: sym,
      value: val,
      asOf: r.date,
      adjusted: hasAdj,
      source: r.source,
      unit: "USD",
      status: 200,
      retryAfterSec: undefined, // success has no retry hint
    };
  } catch (err) {
    console.error("[quotes] getLatestCloseFromQuotes failed:", err);
    return {
      symbol: sym,
      value: null,
      unit: "USD",
      status: 500,
      error: String(err),
      retryAfterSec: undefined,
    };
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

  const url = `/api/quotes/refresh?symbols=${encodeURIComponent(
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
  error?: string;
  retryAfterSec?: number;
};

export async function getCurrentPrice(symbol: string): Promise<CurrentQuote> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { symbol: sym, price: null, status: 400, error: "Symbol required" };

  try {
    const url = `/api/quotes/current?symbol=${encodeURIComponent(sym)}`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });

    if (!resp.ok) {
      let errDetail: string | undefined;
      try {
        const errBody = await resp.json();
        errDetail = errBody.detail;
      } catch {
        /* ignore parse error */
      }

      const retryAfterHeader = resp.headers.get("Retry-After");
      const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

      return {
        symbol: sym,
        price: null,
        status: resp.status,
        error: errDetail || `HTTP ${resp.status} error`,
        retryAfterSec,
      };
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
  } catch (e) {
    return { symbol: sym, price: null, status: 500, error: String(e) };
  }
}
