export type LatestMetric<T = number> = {
  symbol: string;
  value: T | null;
  asOf?: string;
  unit?: string;
  adjusted?: boolean;
  source?: string;
};

export type LatestMetricWithStatus<T = number> = LatestMetric<T> & {
  status?: number;
  error?: string;
  retryAfterSec?: number;
};

export type PriceObjectResponse = {
  price?: number;
  value?: number;
  latest?: number;
  close?: number;
  adjustedClose?: number;
  tradingDate?: string;
  asOf?: string;
  date?: string;
  source?: string;
  currency?: string;
  symbol?: string;
  ticker?: string;
};

export type PriceWrappedResponse =
  | { data: PriceObjectResponse }
  | { result: PriceObjectResponse }
  | { item: PriceObjectResponse };

export type PriceApiResponse = number | PriceObjectResponse | PriceWrappedResponse;