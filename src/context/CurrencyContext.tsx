import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type { CurrencyCode } from "../types/currency";
import {
  convertCurrency,
  formatMoneyDynamic,
  getRates,
  loadExchangeRates,
  updateRates,
} from "../utils/currencyUtils";
import { CurrencyContext } from "./CurrencyContextObject";

export type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<string, number>;
  formatMoney: (amount: number, from?: CurrencyCode) => string;
  formatMoneyFrom: (amount: number, from: CurrencyCode) => string;
  convertToUSD: (amount: number) => number;
  convertFromUSD: (amount: number) => number;
};

interface CurrencyProviderProps {
  children: ReactNode;
}

const defaultCurrency: CurrencyCode = "USD";
const storageKey = "selectedCurrency";

function getInitialCurrency(): CurrencyCode {
  const storedCurrency = localStorage.getItem(storageKey) as CurrencyCode | null;
  return storedCurrency ?? defaultCurrency;
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const [currency, setCurrency] = useState<CurrencyCode>(getInitialCurrency);
  const [rates, setRates] = useState<Record<string, number>>(getRates());

  useEffect(() => {
    const loadRates = async () => {
      try {
        const nextRates = await loadExchangeRates();
        updateRates(nextRates);
        setRates(getRates());
      } catch {
        setRates(getRates());
      }
    };

    void loadRates();
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, currency);
  }, [currency]);

  const formatMoney = useCallback(
    (amount: number, from?: CurrencyCode) => {
      const displayAmount = from && from !== currency ? convertCurrency(amount, from, currency) : amount;

      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(displayAmount);
    },
    [currency],
  );

  const formatMoneyFrom = useCallback(
    (amount: number, from: CurrencyCode) => {
      return formatMoneyDynamic(amount, from, currency);
    },
    [currency],
  );

  const convertToUSD = useCallback(
    (amount: number) => {
      return currency === "USD" ? amount : convertCurrency(amount, currency, "USD");
    },
    [currency],
  );

  const convertFromUSD = useCallback(
    (amount: number) => {
      return currency === "USD" ? amount : convertCurrency(amount, "USD", currency);
    },
    [currency],
  );

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      formatMoney,
      formatMoneyFrom,
      convertToUSD,
      convertFromUSD,
    }),
    [convertFromUSD, convertToUSD, currency, formatMoney, formatMoneyFrom, rates],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}