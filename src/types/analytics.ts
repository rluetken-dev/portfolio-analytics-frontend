// src/types/analytics.ts

/**
 * Generic wrapper for a "latest metric" value.
 * This is the normalized shape your frontend will use everywhere.
 */
export type LatestMetric<T = number> = {
  symbol: string; // e.g., "AAPL"
  value: T | null; // null-safe when backend has no data
  asOf?: string; // ISO date string from backend (e.g., "2025-09-12")
  unit?: string; // e.g., "USD"
  adjusted?: boolean; // true if derived from AdjustedClose
  source?: string; // e.g., "alpha_vantage"
};

// Extends LatestMetric with an optional HTTP status for error hints
export type LatestMetricWithStatus<T = number> = LatestMetric<T> & {
  status?: number;
};

/**
 * Shape your backend might return for /api/analytics/price.
 * We capture all possible fields defensively.
 */
export type PriceObjectResponse = {
  // numeric fields – backend might provide one of these
  price?: number;
  value?: number;
  latest?: number;
  close?: number;
  adjustedClose?: number;

  // date fields – naming may vary
  tradingDate?: string;
  asOf?: string;
  date?: string;

  // meta
  source?: string;
  currency?: string;

  // echo fields
  symbol?: string;
  ticker?: string;
};

// Allow common wrappers like { data: {...} } or { result: {...} }
export type PriceWrappedResponse =
  | { data: PriceObjectResponse }
  | { result: PriceObjectResponse }
  | { item: PriceObjectResponse };

/**
 * Union of all possible responses for /api/analytics/price:
 * - a plain number
 * - or an object with optional fields
 */
export type PriceApiResponse = number | PriceObjectResponse | PriceWrappedResponse;
