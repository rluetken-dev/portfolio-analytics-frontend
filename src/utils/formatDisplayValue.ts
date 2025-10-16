// src/utils/formatDisplayValue.ts
import { useContext, useCallback } from "react";
import { CurrencyContext } from "../context/CurrencyContextObject";

/**
 * Provides a stable display formatter for all analytics values.
 * Automatically respects the global currency context and uses
 * localized formatting for money, ratios, and percentages.
 */
export function useFormatDisplayValue() {
  const { formatMoneyFrom, currency } = useContext(CurrencyContext)!;

  /**
   * Formats a label/value pair for display based on its semantic type.
   */
  const formatDisplayValue = useCallback(
    (label: string, value: number | string | null): string => {
      if (value == null || value === "n/a" || Number.isNaN(value)) return "n/a";

      const num = typeof value === "string" ? parseFloat(value) : value;
      if (!Number.isFinite(num)) return String(value);

      const code = currency;
      const isEuropean = ["EUR", "CHF", "GBP"].includes(code);

      // 💱 Money-like values (formatted with compact notation if large)
      if (["Price", "EPS", "BVPS", "OEPS", "FCF (abs)", "Owner Earnings"].includes(label)) {
        // 🧩 Skip conversion logic if target currency is already USD
        if (currency === "USD") {
          if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(1)} T $`;
          if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)} B $`;
          if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)} M $`;
          return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} $`;
        }

        // For other currencies — convert first, then format compacted
        if (Math.abs(num) >= 1e6) {
          const formatted = formatMoneyFrom(num, "USD") || `${num}`;

          // 🔧 Safe numeric extraction
          const clean = formatted
            .replace(/[^\d.,-]/g, "") // remove all except digits and separators
            .replace(/\.(?=\d{3}(?:\.|,|$))/g, "") // remove thousand separators
            .replace(",", "."); // unify decimal

          const converted = parseFloat(clean);

          // 🧩 Fallback if parsing failed
          if (Number.isNaN(converted)) return formatMoneyFrom(num, "USD");

          const abs = Math.abs(converted);

          const fmt = (v: number, s: string) =>
            `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${s}`;

          let short = "";
          if (abs >= 1e12) short = fmt(converted / 1e12, isEuropean ? " Bio" : " T");
          else if (abs >= 1e9) short = fmt(converted / 1e9, isEuropean ? " Mrd" : " B");
          else if (abs >= 1e6) short = fmt(converted / 1e6, " M");

          const symbolized = formatMoneyFrom(1, "USD");
          const symbol = symbolized.replace(/[0-9.,\s]+/g, "").trim();
          return `${short} ${symbol}`;
        }

        // For smaller numbers, convert and format normally
        return formatMoneyFrom(num, "USD");
      }

      // 📈 Percent values
      if (["ROE", "ROA", "Net Margin", "FCF Yield", "FCF Margin", "OE Yield"].includes(label)) {
        return `${(num * 100).toFixed(1)}%`;
      }

      // 📊 Ratio-type metrics
      if (["P/E", "P/B", "P/OE", "Debt/Equity", "Asset Turnover"].includes(label)) {
        return `${num.toFixed(2)}x`;
      }

      // 🔹 Default numeric format (localized)
      return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
    [formatMoneyFrom, currency],
  );

  return { formatDisplayValue };
}
