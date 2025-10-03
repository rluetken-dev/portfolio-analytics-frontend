import { createContext } from "react";
import type { User } from "../types/auth";

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the AuthContext (default undefined, will be set by AuthProvider)
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
