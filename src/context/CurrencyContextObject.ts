import { createContext } from "react";

import type { CurrencyContextType } from "./CurrencyContext";

export const CurrencyContext = createContext<CurrencyContextType | null>(null);