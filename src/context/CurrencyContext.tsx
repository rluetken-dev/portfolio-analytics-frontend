import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  convertCurrency,
  getRates,
  updateRates,
  loadExchangeRates,
  formatMoneyDynamic,
} from "../utils/currencyUtils";
import type { CurrencyCode } from "../types/currency";
import { CurrencyContext } from "./CurrencyContextObject";

// ---------------- Context Type ----------------
export type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<string, number>;
  formatMoney: (amount: number, from?: CurrencyCode) => string;
  formatMoneyFrom: (amount: number, from: CurrencyCode) => string;
  convertToUSD: (amount: number) => number;       
  convertFromUSD: (amount: number) => number;     
};

// ---------------- Provider ----------------
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyCode>(
    (localStorage.getItem("selectedCurrency") as CurrencyCode) || "USD",
  );
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

  useEffect(() => {
    localStorage.setItem("selectedCurrency", currency);
  }, [currency]);

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

  // Converts and formats an amount from a specific base currency
  const formatMoneyFrom = (amount: number, from: CurrencyCode): string => {
    return formatMoneyDynamic(amount, from, currency);
  };

  // Converts any amount from the current user currency to USD
  const convertToUSD = (amount: number): number => {
    if (currency === "USD") return amount;
    return convertCurrency(amount, currency, "USD");
  };

  // Converts any amount from USD to the current user currency (for display)
  const convertFromUSD = (amount: number): number => {
    if (currency === "USD") return amount;
    return convertCurrency(amount, "USD", currency);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        rates,
        formatMoney,
        formatMoneyFrom, 
        convertToUSD,   
        convertFromUSD, 
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
