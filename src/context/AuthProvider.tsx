import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe, login as apiLogin, logout as apiLogout, refresh } from "../services/api/auth";
import type { User } from "../types/auth";
import { clearAccessToken, getAccessToken, setAccessToken } from "../utils/token";
import { AuthContext } from "./auth-context";

interface AuthProviderProps {
  children: ReactNode;
}

type BalanceResponse = {
  cashBalance?: number;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchBalance = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setBalance(null);
      return;
    }

    const response = await fetch("/api/User/balance", {
      method: "GET",
      credentials: "include",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as BalanceResponse;
    setBalance(typeof data.cashBalance === "number" ? data.cashBalance : null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const currentUser = await fetchMe();

        if (!isMounted) {
          return;
        }

        setUser(currentUser);
        await fetchBalance();
      } catch {
        try {
          const tokens = await refresh();
          setAccessToken(tokens.accessToken);

          const currentUser = await fetchMe();

          if (!isMounted) {
            return;
          }

          setUser(currentUser);
          await fetchBalance();
        } catch {
          if (!isMounted) {
            return;
          }

          clearAccessToken();
          setUser(null);
          setBalance(null);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [fetchBalance]);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await apiLogin({ username, password });

      setAccessToken(response.accessToken);
      setUser(response.user);
      await fetchBalance();
    },
    [fetchBalance],
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearAccessToken();
      setUser(null);
      setBalance(null);
      navigate("/login");
    }
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
        balance,
        setBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}