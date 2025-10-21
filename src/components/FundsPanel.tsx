import { useEffect, useRef, useState } from "react";
import { deposit, withdraw } from "../services/api/userBalance";
import { useCurrency } from "../hooks/useCurrency";

interface FundsPanelProps {
  currencySymbol: string;
  refreshBalance: () => Promise<void>;
}

export function FundsPanel({ currencySymbol, refreshBalance }: FundsPanelProps) {
  const [amount, setAmount] = useState("0.00");
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const { currency, convertToUSD } = useCurrency();

  // 🔹 Close panel on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const details = panelRef.current?.closest("details");
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (details) details.open = false;
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🔹 Perform deposit or withdraw (auto-converts to USD before API call)
    const handleAction = async (type: "deposit" | "withdraw") => {
    const value = parseFloat(amount);
    setError("");

    if (isNaN(value) || value <= 0) {
        setError("❌ Please enter a valid positive amount.");
        return;
    }

    try {
        // 💱 Convert entered value (from user's currency) to USD before sending
        const usdValue = convertToUSD(value);

        console.log(
        `💱 Converting ${value} ${currency} → ${usdValue.toFixed(2)} USD before ${type}.`
        );

        if (type === "deposit") await deposit(usdValue);
        else await withdraw(usdValue);

        setAmount("0.00");
        await refreshBalance();

        // ✅ Close the details dropdown after successful transaction
        const details = panelRef.current?.closest("details");
        if (details) details.open = false;
    } catch (err) {
        if (err instanceof Error) {
        console.error(`${type} failed:`, err.message);
        if (err.message.includes("400"))
            setError("❌ Insufficient funds – check your balance.");
        else setError(`❌ ${type} failed – please try again.`);
        } else {
        console.error("Unknown error:", err);
        setError("❌ Unexpected error occurred.");
        }
    }
    };

  return (
    <div ref={panelRef} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* 💵 Amount input */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#888", fontSize: 14 }}>{currencySymbol}</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
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
      </div>

      {/* 💰 Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => handleAction("deposit")}
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
          +💰 Deposit
        </button>
        <button
          onClick={() => handleAction("withdraw")}
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
          −💸 Withdraw
        </button>
      </div>

      {/* ⚠️ Error message */}
      {error && (
        <div
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
