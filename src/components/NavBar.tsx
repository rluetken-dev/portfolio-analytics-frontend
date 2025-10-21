import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { AuthBadge } from "./AuthBadge";
import { useCurrency } from "../hooks/useCurrency";
import type { CurrencyCode } from "../types/currency";
import { useUserBalance } from "../hooks/useUserBalance";
import { useContext } from "react";
import { AuthContext } from "../context/auth-context";
import { deposit, withdraw } from "../services/api/userBalance";

/**
 * Top navigation bar.
 * - Static navigation links
 * - Dynamic company chip (on /company/:symbol)
 * - Global currency switcher with persistent state
 */
export default function NavBar() {
  const { pathname } = useLocation();
  const { currency, setCurrency, formatMoneyFrom } = useCurrency();
  const { cashBalance, refreshBalance } = useUserBalance();

  // Access AuthContext safely to avoid undefined errors
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("NavBar must be used within an AuthProvider");
  }
  const { isAuthenticated } = auth;

  // --- Dropdown logic for currency menu ---
  const [open, setOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setIsAnimating(true);
    } else {
      const timeout = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Match company symbol from route ---
  const match = useMatch("/company/:symbol");
  const sym = match?.params.symbol?.toUpperCase();

  // --- Style helper for links ---
  const linkStyle = (to: string): React.CSSProperties => ({
    marginRight: "1rem",
    textDecoration: pathname === to ? "underline" : "none",
    fontWeight: pathname === to ? 700 : 400,
  });

  return (
    <nav
      style={{
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {/* Left: static navigation */}
      <div>
        <Link to="/" style={linkStyle("/")}>
          Home
        </Link>
        <Link to="/companies" style={linkStyle("/companies")}>
          Companies
        </Link>
        <Link to="/about" style={linkStyle("/about")}>
          About
        </Link>
        <Link to="/health" style={linkStyle("/health")}>
          Health
        </Link>
      </div>

      <div style={{ flex: 1 }} />

      {/* Show current company chip (if any) */}
      {sym && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            to={`/company/${sym}`}
            title={`Open details for ${sym}`}
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              border: "1px solid #22c55e",
              background: "rgba(34, 197, 94, 0.12)",
              color: "#22c55e",
              textDecoration: "none",
              fontSize: 12,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            Company: {sym}
          </Link>
        </div>
      )}

      {/* 💰 Show balance when logged in */}
      {isAuthenticated && cashBalance !== null && (
        <div
          style={{
            color: "#22c55e",
            fontSize: 13,
            fontWeight: 500,
            marginRight: "1rem",
            whiteSpace: "nowrap",
          }}
          title="Current cash balance"
        >
          {/* 💰 Format balance according to selected currency */}
          💰 {formatMoneyFrom(cashBalance, "USD")}
        </div>
      )}

      {/* 💸 Deposit / Withdraw Controls */}
      {isAuthenticated && (
        <div style={{ position: "relative", marginRight: "1rem" }}>
          <details
            onToggle={(e) => {
              // clear all inputs when panel closes
              const details = e.currentTarget;
              if (!details.open) {
                const inputs = details.querySelectorAll("input");
                const errors = details.querySelectorAll(".error-box");
                inputs.forEach((i) => (i.value = ""));
                errors.forEach((e) => (e.textContent = ""));
              }
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                color: "#22c55e",
                userSelect: "none",
              }}
            >
              ⚙️ Funds
            </summary>

            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                background: "#1e1e1e",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "8px 10px",
                marginTop: 4,
                zIndex: 99,
                minWidth: 180,
              }}
            >
              {/* 💰 Deposit Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.querySelector("input") as HTMLInputElement;
                  const errorBox = form.querySelector(".error-box") as HTMLDivElement;
                  const raw = input.value.trim();
                  const amount = parseFloat(raw);

                  errorBox.textContent = "";

                  if (!raw || isNaN(amount) || amount <= 0) {
                    errorBox.textContent = "❌ Please enter a valid positive amount.";
                    return;
                  }

                  try {
                    const res = await deposit(amount);
                    console.log("✅ Deposit successful:", res);
                    input.value = "";
                    refreshBalance();
                  } catch (err) {
                    if (err instanceof Error) {
                      console.error("Deposit failed:", err.message);
                      errorBox.textContent = "❌ Deposit failed – please try again later.";
                    } else {
                      console.error("Unknown error during deposit:", err);
                      errorBox.textContent = "❌ Unexpected error occurred.";
                    }
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    min="0"
                    style={{
                      flex: 1,
                      background: "#111",
                      color: "white",
                      border: "1px solid #444",
                      borderRadius: 6,
                      padding: "2px 6px",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: "#22c55e",
                      color: "black",
                      border: "none",
                      borderRadius: 6,
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    +💰
                  </button>
                </div>
                <div
                  className="error-box"
                  style={{
                    minHeight: "1em",
                    fontSize: 12,
                    color: "#f87171",
                    marginTop: 2,
                  }}
                ></div>
              </form>

              {/* 💸 Withdraw Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.querySelector("input") as HTMLInputElement;
                  const errorBox = form.querySelector(".error-box") as HTMLDivElement;
                  const raw = input.value.trim();
                  const amount = parseFloat(raw);

                  errorBox.textContent = "";

                  if (!raw || isNaN(amount) || amount <= 0) {
                    errorBox.textContent = "❌ Please enter a valid positive amount.";
                    return;
                  }

                  try {
                    const res = await withdraw(amount);
                    console.log("✅ Withdraw successful:", res);
                    input.value = "";
                    refreshBalance();
                  } catch (err) {
                    if (err instanceof Error) {
                      console.error("Withdraw failed:", err.message);
                      if (err.message.includes("400")) {
                        errorBox.textContent = "❌ Insufficient funds – check your balance.";
                      } else {
                        errorBox.textContent = "❌ Withdrawal failed – please try again.";
                      }
                    } else {
                      console.error("Unknown error during withdrawal:", err);
                      errorBox.textContent = "❌ Unexpected error occurred.";
                    }
                  }
                }}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    min="0"
                    style={{
                      flex: 1,
                      background: "#111",
                      color: "white",
                      border: "1px solid #444",
                      borderRadius: 6,
                      padding: "2px 6px",
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      background: "#f87171",
                      color: "black",
                      border: "none",
                      borderRadius: 6,
                      padding: "2px 8px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    −💸
                  </button>
                </div>
                <div
                  className="error-box"
                  style={{
                    minHeight: "1em",
                    fontSize: 12,
                    color: "#f87171",
                    marginTop: 2,
                  }}
                ></div>
              </form>
            </div>
          </details>
        </div>
      )}

      {/* 💱 Currency Switcher Button */}
      <div ref={dropdownRef} style={{ position: "relative", marginRight: "1rem" }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "#111",
            border: "1px solid #444",
            borderRadius: 6,
            color: "white",
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          💱 {currency} ▼
        </button>

        {/* Animated dropdown with delayed unmount */}
        {(open || isAnimating) && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 4px)",
              background: "#1e1e1e",
              border: "1px solid #333",
              borderRadius: 8,
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
              zIndex: 100,
              minWidth: 100,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.25s ease, transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)",
              pointerEvents: open ? "auto" : "none",
            }}
          >
            {["USD", "EUR", "CHF", "GBP", "JPY"].map((code) => (
              <div
                key={code}
                onClick={() => {
                  setCurrency(code as CurrencyCode);
                  setOpen(false);
                }}
                style={{
                  padding: "6px 12px",
                  cursor: "pointer",
                  background: code === currency ? "#333" : "transparent",
                  color: code === currency ? "#22c55e" : "white",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "#2a2a2a";
                  (e.currentTarget as HTMLDivElement).style.color = "#22c55e";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    code === currency ? "#333" : "transparent";
                  (e.currentTarget as HTMLDivElement).style.color =
                    code === currency ? "#22c55e" : "white";
                }}
              >
                {code}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Always show AuthBadge */}
      <AuthBadge />
    </nav>
  );
}
