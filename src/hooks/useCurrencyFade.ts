import { useEffect, useState, useContext } from "react";
import { CurrencyContext } from "../context/CurrencyContextObject";

/**
 * Hook: handles a two-phase fade animation on currency change
 * Returns both the CSS class and an 'isAnimating' flag.
 */
export function useCurrencyFade(duration: number = 300) {
  const { currency } = useContext(CurrencyContext)!;
  const [isAnimating, setIsAnimating] = useState(false);
  const [fadeClass, setFadeClass] = useState("");

  useEffect(() => {
    // Phase 1: start fade-out
    setFadeClass("fade-currency-out");
    setIsAnimating(true);

    // Phase 2: fade-in after half the duration
    const mid = setTimeout(() => setFadeClass("fade-currency-in"), duration / 2);

    // Phase 3: reset after full duration
    const end = setTimeout(() => {
      setFadeClass("");
      setIsAnimating(false);
    }, duration);

    return () => {
      clearTimeout(mid);
      clearTimeout(end);
    };
  }, [currency, duration]);

  return { fadeClass, isAnimating };
}
