import { createContext } from "react";
import type { User } from "../types/auth";

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  balance: number | null;
  setBalance: (value: number | null) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
