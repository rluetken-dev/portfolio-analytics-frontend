import { useEffect, useRef, useState } from "react";

import { useCurrency } from "../hooks/useCurrency";
import { deposit, withdraw } from "../services/api/userBalance";

interface FundsPanelProps {
  currencySymbol: string;
  refreshBalance: () => Promise<void>;
}

type FundsAction = "deposit" | "withdraw";

export function FundsPanel({ currencySymbol, refreshBalance }: FundsPanelProps) {
  const [amount, setAmount] = useState("0.00");
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const { convertToUSD } = useCurrency();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const details = panelRef.current?.closest("details");

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        if (details) {
          details.open = false;
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closePanel = () => {
    const details = panelRef.current?.closest("details");

    if (details) {
      details.open = false;
    }
  };

  const handleAction = async (action: FundsAction) => {
    const value = Number(amount);
    setError("");

    if (!Number.isFinite(value) || value <= 0) {
      setError("Please enter a positive amount.");
      return;
    }

    try {
      const usdValue = convertToUSD(value);

      if (action === "deposit") {
        await deposit(usdValue);
      } else {
        await withdraw(usdValue);
      }

      setAmount("0.00");
      await refreshBalance();
      closePanel();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (message.includes("400")) {
        setError("Insufficient funds. Check your balance.");
        return;
      }

      setError(`${action === "deposit" ? "Deposit" : "Withdrawal"} failed. Please try again.`);
    }
  };

  return (
    <div ref={panelRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#888", fontSize: 14 }}>{currencySymbol}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          aria-label="Amount"
          onChange={(event) => setAmount(event.target.value)}
          style={{
            flex: 1,
            background: "#111",
            color: "white",
            border: "1px solid #444",
            borderRadius: 6,
            padding: "4px 6px",
            fontSize: 13,
          }}
        />
      </label>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={() => void handleAction("deposit")}
          style={{
            flex: 1,
            background: "#22c55e",
            color: "black",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Deposit
        </button>

        <button
          type="button"
          onClick={() => void handleAction("withdraw")}
          style={{
            flex: 1,
            background: "#f87171",
            color: "black",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Withdraw
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "#f87171",
            minHeight: "1em",
            marginTop: 2,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}