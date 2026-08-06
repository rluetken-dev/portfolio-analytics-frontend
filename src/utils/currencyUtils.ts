import { currencySymbols } from "../constants/currencySymbols";
import type { CurrencyCode } from "../types/currency";

export type ExchangeRates = Record<CurrencyCode, number>;

type CurrencyApiResponse = {
  usd?: Partial<Record<string, number>>;
};

const exchangeRateApiUrl =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";

let cachedRates: ExchangeRates = {
  USD: 1,
  EUR: 0.8641882,
  CHF: 0.80419951,
  GBP: 0.74943947,
  JPY: 152.45126478,
};

const supportedCurrencies: CurrencyCode[] = ["USD", "EUR", "CHF", "GBP", "JPY"];

function isCurrencyCode(value: string): value is CurrencyCode {
  return supportedCurrencies.includes(value as CurrencyCode);
}

export async function loadExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch(exchangeRateApiUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates: HTTP ${response.status}`);
  }

  const data = (await response.json()) as CurrencyApiResponse;
  const usdRates = data.usd;

  if (!usdRates) {
    throw new Error("Invalid exchange rate response.");
  }

  const nextRates = { ...cachedRates };

  for (const currency of supportedCurrencies) {
    const key = currency.toLowerCase();
    const rate = usdRates[key];

    if (typeof rate === "number" && Number.isFinite(rate)) {
      nextRates[currency] = rate;
    }
  }

  cachedRates = nextRates;
  return getRates();
}

export function convertCurrency(amount: number, from: CurrencyCode = "USD", to: CurrencyCode = "USD") {
  if (from === to) {
    return amount;
  }

  const fromRate = cachedRates[from];
  const toRate = cachedRates[to];

  if (!fromRate || !toRate) {
    return amount;
  }

  return (amount / fromRate) * toRate;
}

export function updateRates(newRates: Partial<ExchangeRates>) {
  cachedRates = { ...cachedRates, ...newRates };
}

export function getRates(): ExchangeRates {
  return { ...cachedRates };
}

export function formatMoneyDynamic(amount: number, from: CurrencyCode = "USD", to: CurrencyCode = "USD") {
  const convertedAmount = convertCurrency(amount, from, to);
  const symbol = currencySymbols[to];

  return `${new Intl.NumberFormat(to === "USD" ? "en-US" : "de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(convertedAmount)} ${symbol}`;
}

export function parseCurrencyCode(value: string, fallback: CurrencyCode = "USD"): CurrencyCode {
  const normalizedValue = value.trim().toUpperCase();

  return isCurrencyCode(normalizedValue) ? normalizedValue : fallback;
}