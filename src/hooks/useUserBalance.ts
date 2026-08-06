import { useCallback, useContext, useState } from "react";

import { AuthContext } from "../context/auth-context";
import { getAccessToken } from "../utils/token";

interface UserBalanceResponse {
  username: string;
  cashBalance: number;
}

type ApiErrorResponse = {
  message?: string;
};

export function useUserBalance() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useUserBalance must be used within an AuthProvider.");
  }

  const { balance, setBalance, isAuthenticated } = context;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!isAuthenticated) {
      setBalance(null);
      return;
    }

    const token = getAccessToken();

    if (!token) {
      setBalance(null);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/User/balance", {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as UserBalanceResponse;

      setBalance(data.cashBalance);
      setError(null);
    } catch {
      setError("Failed to load balance.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, setBalance]);

  const deposit = useCallback(
    async (amount: number) => {
      if (amount <= 0) {
        throw new Error("Amount must be positive.");
      }

      const token = getAccessToken();

      if (!token) {
        throw new Error("Missing access token.");
      }

      const response = await fetch("/api/User/deposit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(amount),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await refreshBalance();
    },
    [refreshBalance],
  );

  const withdraw = useCallback(
    async (amount: number) => {
      if (amount <= 0) {
        throw new Error("Amount must be positive.");
      }

      const token = getAccessToken();

      if (!token) {
        throw new Error("Missing access token.");
      }

      const response = await fetch("/api/User/withdraw", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(amount),
      });

      if (response.status === 400) {
        const data = (await response.json()) as ApiErrorResponse;
        throw new Error(data.message || "Insufficient funds.");
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      await refreshBalance();
    },
    [refreshBalance],
  );

  return {
    cashBalance: balance,
    loading,
    error,
    deposit,
    withdraw,
    refreshBalance,
  };
}