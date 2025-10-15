import type { CurrencyCode } from "../types/currency";

/**
 * Currency symbols for supported codes.
 * Extend this list as needed — it's type-safe via CurrencyCode.
 */
export const currencySymbols: Record<CurrencyCode, string> = {
  USD: "$",
  EUR: "€",
  CHF: "₣",
  GBP: "£",
  JPY: "¥",
};
