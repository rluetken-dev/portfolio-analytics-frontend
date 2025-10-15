import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { convertCurrency, getRates, updateRates, loadExchangeRates } from "../utils/currencyUtils";
import type { CurrencyCode } from "../types/currency";
import { CurrencyContext } from "./CurrencyContextObject";

// ---------------- Context Type ----------------
export type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<string, number>;
  formatMoney: (amount: number, from?: CurrencyCode) => string;
};

// ---------------- Provider ----------------
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<Record<string, number>>(getRates());

  useEffect(() => {
    (async () => {
      try {
        const newRates = await loadExchangeRates();
        updateRates(newRates);
        setRates(getRates());
      } catch (err) {
        console.error("Failed to fetch exchange rates:", err);
      }
    })();
  }, []);

  const formatMoney = (amount: number, from?: CurrencyCode): string => {
    let displayAmount = amount;
    if (from && from !== currency) {
      displayAmount = convertCurrency(amount, from, currency);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayAmount);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, formatMoney }}>
      {children}
    </CurrencyContext.Provider>
  );
}
