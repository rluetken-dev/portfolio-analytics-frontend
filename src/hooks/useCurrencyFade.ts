import { useContext, useEffect, useState } from "react";

import { CurrencyContext } from "../context/CurrencyContextObject";

export function useCurrencyFade(durationMs = 300) {
  const currencyContext = useContext(CurrencyContext);

  if (!currencyContext) {
    throw new Error("useCurrencyFade must be used within a CurrencyProvider.");
  }

  const { currency } = currencyContext;
  const [isAnimating, setIsAnimating] = useState(false);
  const [fadeClass, setFadeClass] = useState("");

  useEffect(() => {
    setFadeClass("fade-currency-out");
    setIsAnimating(true);

    const fadeInTimeoutId = window.setTimeout(() => {
      setFadeClass("fade-currency-in");
    }, durationMs / 2);

    const resetTimeoutId = window.setTimeout(() => {
      setFadeClass("");
      setIsAnimating(false);
    }, durationMs);

    return () => {
      window.clearTimeout(fadeInTimeoutId);
      window.clearTimeout(resetTimeoutId);
    };
  }, [currency, durationMs]);

  return { fadeClass, isAnimating };
}