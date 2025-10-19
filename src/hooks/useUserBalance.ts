// src/hooks/useUserBalance.ts
import { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/auth-context";
import { getAccessToken } from "../utils/token";

interface UserBalanceResponse {
  username: string;
  cashBalance: number;
}

export function useUserBalance() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useUserBalance must be used within an AuthProvider");
  }

  const { isAuthenticated, user } = context;
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ shared fetch logic
  const fetchBalance = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch("/api/User/balance", {
        method: "GET",
        credentials: "include",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserBalanceResponse = await res.json();
      setBalance(data.cashBalance);
      setError(null);
    } catch (err) {
      console.error("❌ Error fetching balance:", err);
      setError("Failed to load balance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setBalance(null);
      return;
    }

    const delay = setTimeout(() => {
      void fetchBalance();
    }, 250);

    return () => clearTimeout(delay);
  }, [isAuthenticated, user, fetchBalance]);

  // ✅ Return now includes manual refresh function
  return { balance, loading, error, refreshBalance: fetchBalance };
}
