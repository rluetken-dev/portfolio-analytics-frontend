// src/hooks/useUserBalance.ts
import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/auth-context";
import { getAccessToken } from "../utils/token"; // ✅ import token getter

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

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setBalance(null);
      return;
    }

    const delay = setTimeout(() => {
      const fetchBalance = async () => {
        const token = getAccessToken(); // ✅ get in-memory JWT
        if (!token) {
          console.warn("No access token available, skipping balance fetch.");
          return;
        }

        setLoading(true);
        try {
          const res = await fetch("/api/User/balance", {
            method: "GET",
            credentials: "include",
            headers: {
              Authorization: `Bearer ${token}`, // ✅ include JWT
            },
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: UserBalanceResponse = await res.json();

          console.log("✅ useUserBalance fetched:", data);
          setBalance(data.cashBalance);
          setError(null);
        } catch (err) {
          console.error("❌ Error fetching balance:", err);
          setError("Failed to load balance");
        } finally {
          setLoading(false);
        }
      };

      fetchBalance();
    }, 250);

    return () => clearTimeout(delay);
  }, [isAuthenticated, user]);

  return { balance, loading, error };
}
