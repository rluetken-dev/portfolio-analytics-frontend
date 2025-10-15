import { createContext } from "react";
import type { CurrencyContextType } from "./CurrencyContext";

// just the context object, no React components here
export const CurrencyContext = createContext<CurrencyContextType | null>(null);
