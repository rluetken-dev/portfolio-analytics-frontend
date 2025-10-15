/**
 * Basic currency conversion utility.
 * Converts amounts between currencies using a rates cache (base: USD).
 */

// Define supported currency codes
export type CurrencyCode = "USD" | "EUR" | "CHF" | "GBP" | "JPY";

// Export the ExchangeRates type (so Context can import it)
export type ExchangeRates = Record<CurrencyCode, number>;

// Default static fallback rates (used before API update)
let cachedRates: ExchangeRates = {
  USD: 1,
  EUR: 0.8641882,
  CHF: 0.80419951,
  GBP: 0.74943947,
  JPY: 152.45126478,
};

// ✅ Add missing function: loadExchangeRates
const API_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";

/**
 * Load latest exchange rates (base = USD) from public CDN API.
 */
export async function loadExchangeRates(): Promise<ExchangeRates> {
  const resp = await fetch(API_URL);
  if (!resp.ok) throw new Error(`Failed to fetch exchange rates: HTTP ${resp.status}`);

  const data = await resp.json();
  if (!data?.usd) throw new Error("Invalid exchange rate format");

  cachedRates = {
    ...cachedRates,
    ...Object.fromEntries(
      Object.entries(data.usd).filter(([, v]) => typeof v === "number" && !Number.isNaN(v)),
    ),
  };

  return cachedRates;
}

/**
 * Convert between currencies.
 * @param amount Amount to convert
 * @param from Source currency (default: USD)
 * @param to Target currency (default: USD)
 */
export function convertCurrency(
  amount: number,
  from: CurrencyCode = "USD",
  to: CurrencyCode = "USD",
): number {
  if (from === to) return amount;

  const fromRate = cachedRates[from];
  const toRate = cachedRates[to];

  if (!fromRate || !toRate) {
    console.warn(`[convertCurrency] Unknown currency: ${from} or ${to}`);
    return amount;
  }

  // Convert via USD as intermediary
  const inUsd = amount / fromRate;
  return inUsd * toRate;
}

/**
 * Replace part or all of the current exchange rates.
 */
export function updateRates(newRates: Partial<ExchangeRates>): void {
  cachedRates = { ...cachedRates, ...newRates };
}

/**
 * Get a snapshot of the current rates (for display/debug).
 */
export function getRates(): ExchangeRates {
  return { ...cachedRates };
}
