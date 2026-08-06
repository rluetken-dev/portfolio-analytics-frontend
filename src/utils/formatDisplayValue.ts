import { useCallback, useContext } from "react";

import { CurrencyContext } from "../context/CurrencyContextObject";

const moneyLabels = new Set(["Price", "EPS", "BVPS", "OEPS", "FCF (abs)", "Owner Earnings"]);
const percentLabels = new Set(["ROE", "ROA", "Net Margin", "FCF Yield", "FCF Margin", "OE Yield"]);
const ratioLabels = new Set(["P/E", "P/B", "P/OE", "Debt/Equity", "Asset Turnover"]);

function formatUsdCompact(value: number) {
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1e12) {
    return `${(value / 1e12).toFixed(1)} T $`;
  }

  if (absoluteValue >= 1e9) {
    return `${(value / 1e9).toFixed(1)} B $`;
  }

  if (absoluteValue >= 1e6) {
    return `${(value / 1e6).toFixed(1)} M $`;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} $`;
}

function parseFormattedNumber(value: string) {
  const normalizedValue = value
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}(?:\.|,|$))/g, "")
    .replace(",", ".");

  const parsedValue = Number.parseFloat(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatCompactNumber(value: number, isEuropean: boolean) {
  const absoluteValue = Math.abs(value);
  const format = (numberValue: number, suffix: string) =>
    `${numberValue >= 100 ? numberValue.toFixed(0) : numberValue >= 10 ? numberValue.toFixed(1) : numberValue.toFixed(2)}${suffix}`;

  if (absoluteValue >= 1e12) {
    return format(value / 1e12, isEuropean ? " Bio" : " T");
  }

  if (absoluteValue >= 1e9) {
    return format(value / 1e9, isEuropean ? " Mrd" : " B");
  }

  if (absoluteValue >= 1e6) {
    return format(value / 1e6, " M");
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function extractCurrencySymbol(value: string) {
  return value.replace(/[0-9.,\s]+/g, "").trim();
}

export function useFormatDisplayValue() {
  const currencyContext = useContext(CurrencyContext);

  if (!currencyContext) {
    throw new Error("useFormatDisplayValue must be used within a CurrencyProvider.");
  }

  const { formatMoneyFrom, currency } = currencyContext;

  const formatDisplayValue = useCallback(
    (label: string, value: number | string | null): string => {
      if (value == null || value === "n/a") {
        return "n/a";
      }

      const numericValue = typeof value === "string" ? Number.parseFloat(value) : value;

      if (!Number.isFinite(numericValue)) {
        return String(value);
      }

      if (moneyLabels.has(label)) {
        if (currency === "USD") {
          return formatUsdCompact(numericValue);
        }

        if (Math.abs(numericValue) >= 1e6) {
          const formattedValue = formatMoneyFrom(numericValue, "USD");
          const convertedValue = parseFormattedNumber(formattedValue);

          if (convertedValue === null) {
            return formattedValue;
          }

          const currencySymbol = extractCurrencySymbol(formatMoneyFrom(1, "USD"));
          const isEuropean = ["EUR", "CHF", "GBP"].includes(currency);

          return `${formatCompactNumber(convertedValue, isEuropean)} ${currencySymbol}`;
        }

        return formatMoneyFrom(numericValue, "USD");
      }

      if (percentLabels.has(label)) {
        return `${(numericValue * 100).toFixed(1)}%`;
      }

      if (ratioLabels.has(label)) {
        return `${numericValue.toFixed(2)}x`;
      }

      return numericValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    },
    [currency, formatMoneyFrom],
  );

  return { formatDisplayValue };
}