import { useContext } from "react";

import { CurrencyContext } from "../context/CurrencyContextObject";

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider.");
  }

  return context;
}