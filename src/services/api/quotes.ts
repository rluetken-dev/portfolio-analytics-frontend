import type { LatestMetricWithStatus } from "../../types/analytics";

type QuoteRow = {
  date?: string;
  close?: number;
  adjustedClose?: number;
  source?: string;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

type RefreshResponse = {
  ok: boolean;
  symbols: string[];
  inserted: number;
  skipped: number;
};

export type CurrentQuote = {
  symbol: string;
  price: number | null;
  latestTradingDay?: string;
  status: number;
  error?: string;
  retryAfterSec?: number;
};

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function parseRetryAfter(response: Response) {
  const retryAfter = response.headers.get("Retry-After");

  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function readApiError(response: Response) {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    return data.detail ?? data.message;
  } catch {
    return undefined;
  }
}

export async function getLatestCloseFromQuotes(symbol: string): Promise<LatestMetricWithStatus> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return {
      symbol: normalizedSymbol,
      value: null,
      unit: "USD",
      status: 400,
      error: "Symbol required.",
    };
  }

  try {
    const response = await fetch(
      `/api/quotes/latest?symbol=${encodeURIComponent(normalizedSymbol)}&take=1`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) {
      return {
        symbol: normalizedSymbol,
        value: null,
        unit: "USD",
        status: response.status,
        error:
          response.status === 429
            ? (await readApiError(response)) ?? "Rate limit reached. Please try again later."
            : await readApiError(response),
        retryAfterSec: parseRetryAfter(response),
      };
    }

    const rows = (await response.json()) as QuoteRow[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        symbol: normalizedSymbol,
        value: null,
        unit: "USD",
        status: 404,
      };
    }

    const latestQuote = rows[0];
    const adjustedClose =
      typeof latestQuote.adjustedClose === "number" ? latestQuote.adjustedClose : null;
    const close = typeof latestQuote.close === "number" ? latestQuote.close : null;
    const value: number | null = adjustedClose ?? close;
    const hasAdjustedClose = adjustedClose !== null;
    
    return {
      symbol: normalizedSymbol,
      value,
      asOf: latestQuote.date,
      adjusted: hasAdjustedClose,
      source: latestQuote.source,
      unit: "USD",
      status: 200,
    };
  } catch (error) {
    return {
      symbol: normalizedSymbol,
      value: null,
      unit: "USD",
      status: 500,
      error: error instanceof Error ? error.message : "Failed to load latest quote.",
    };
  }
}

export async function refreshQuotes(symbols: string, range = "24m"): Promise<RefreshResponse> {
  const normalizedSymbols = symbols.trim();

  if (!normalizedSymbols) {
    throw new Error("Symbols are required.");
  }

  const response = await fetch(
    `/api/quotes/refresh?symbols=${encodeURIComponent(normalizedSymbols)}&range=${encodeURIComponent(
      range,
    )}`,
    {
      method: "POST",
      headers: { Accept: "application/json" },
    },
  );

  if (!response.ok) {
    const message = await readApiError(response);
    throw new Error(message ?? `HTTP ${response.status}`);
  }

  return (await response.json()) as RefreshResponse;
}

export async function getCurrentPrice(symbol: string): Promise<CurrentQuote> {
  const normalizedSymbol = normalizeSymbol(symbol);

  if (!normalizedSymbol) {
    return {
      symbol: normalizedSymbol,
      price: null,
      status: 400,
      error: "Symbol required.",
    };
  }

  try {
    const response = await fetch(`/api/quotes/current?symbol=${encodeURIComponent(normalizedSymbol)}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        symbol: normalizedSymbol,
        price: null,
        status: response.status,
        error: (await readApiError(response)) ?? `HTTP ${response.status}`,
        retryAfterSec: parseRetryAfter(response),
      };
    }

    const data = (await response.json()) as {
      symbol?: string;
      price?: number;
      latestTradingDay?: string;
    };

    return {
      symbol: data.symbol ?? normalizedSymbol,
      price: typeof data.price === "number" ? data.price : null,
      latestTradingDay: data.latestTradingDay,
      status: 200,
    };
  } catch (error) {
    return {
      symbol: normalizedSymbol,
      price: null,
      status: 500,
      error: error instanceof Error ? error.message : "Failed to load current quote.",
    };
  }
}