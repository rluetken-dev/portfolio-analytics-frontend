import { useContext, useCallback, useState } from "react";
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

  const { balance, setBalance, isAuthenticated } = context;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fetch balance from backend and update global state
  const refreshBalance = useCallback(async () => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated, setBalance]);

  // ✅ Deposit
  const deposit = useCallback(
    async (amount: number) => {
      if (amount <= 0) throw new Error("Amount must be positive.");
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch("/api/User/deposit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(amount),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await refreshBalance(); // 🔄 sync global balance after deposit
    },
    [refreshBalance],
  );

  // ✅ Withdraw
  const withdraw = useCallback(
    async (amount: number) => {
      if (amount <= 0) throw new Error("Amount must be positive.");
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch("/api/User/withdraw", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(amount),
      });

      if (res.status === 400) {
        const err = await res.json();
        throw new Error(err.message || "Insufficient funds");
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      await refreshBalance(); // 🔄 sync global balance after withdraw
    },
    [refreshBalance],
  );

  return {
    cashBalance: balance, // ✅ expose global balance (renamed for clarity)
    loading,
    error,
    deposit,
    withdraw,
    refreshBalance,
  };
}
