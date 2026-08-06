import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";

import { AuthBadge } from "./AuthBadge";
import { FundsPanel } from "./FundsPanel";
import { useAuth } from "../hooks/useAuth";
import { useCurrency } from "../hooks/useCurrency";
import { useUserBalance } from "../hooks/useUserBalance";
import type { CurrencyCode } from "../types/currency";

const supportedCurrencies: CurrencyCode[] = ["USD", "EUR", "CHF", "GBP", "JPY"];

const navStyle: CSSProperties = {
  marginBottom: "1rem",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const menuStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const panelStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 4px)",
  background: "#1e1e1e",
  border: "1px solid #333",
  borderRadius: 8,
  boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  zIndex: 100,
};

export default function NavBar() {
  const { pathname } = useLocation();
  const companyMatch = useMatch("/company/:symbol");
  const companySymbol = companyMatch?.params.symbol?.toUpperCase();

  const { isAuthenticated } = useAuth();
  const { currency, setCurrency, formatMoneyFrom } = useCurrency();
  const { cashBalance, refreshBalance } = useUserBalance();

  const [isCurrencyMenuOpen, setIsCurrencyMenuOpen] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeCurrencyMenu = (event: MouseEvent) => {
      if (
        currencyMenuRef.current &&
        !currencyMenuRef.current.contains(event.target as Node)
      ) {
        setIsCurrencyMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeCurrencyMenu);
    return () => document.removeEventListener("mousedown", closeCurrencyMenu);
  }, []);

  const linkStyle = (to: string): CSSProperties => ({
    textDecoration: pathname === to ? "underline" : "none",
    fontWeight: pathname === to ? 700 : 400,
  });

  return (
    <nav style={navStyle} aria-label="Main navigation">
      <div style={menuStyle}>
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

      {companySymbol && (
        <Link
          to={`/company/${companySymbol}`}
          title={`Open details for ${companySymbol}`}
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid #22c55e",
            background: "rgba(34, 197, 94, 0.12)",
            color: "#15803d",
            textDecoration: "none",
            fontSize: 12,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
          }}
        >
          Company: {companySymbol}
        </Link>
      )}

      {isAuthenticated && cashBalance !== null && (
        <div
          title="Current cash balance"
          style={{
            color: "#15803d",
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Cash: {formatMoneyFrom(cashBalance, "USD")}
        </div>
      )}

      {isAuthenticated && (
        <div style={{ position: "relative" }}>
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontSize: 13,
                color: "#15803d",
                userSelect: "none",
              }}
            >
              Funds
            </summary>

            <div
              style={{
                ...panelStyle,
                top: "100%",
                padding: 10,
                marginTop: 4,
                minWidth: 220,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <FundsPanel
                currencySymbol={formatMoneyFrom(0, currency).replace(/[\d.,]/g, "").trim() || "$"}
                refreshBalance={refreshBalance}
              />
            </div>
          </details>
        </div>
      )}

      <div ref={currencyMenuRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isCurrencyMenuOpen}
          onClick={() => setIsCurrencyMenuOpen((current) => !current)}
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
          {currency}
        </button>

        {isCurrencyMenuOpen && (
          <div
            role="menu"
            style={{
              ...panelStyle,
              minWidth: 100,
              overflow: "hidden",
            }}
          >
            {supportedCurrencies.map((code) => (
              <button
                key={code}
                type="button"
                role="menuitem"
                onClick={() => {
                  setCurrency(code);
                  setIsCurrencyMenuOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "6px 12px",
                  border: 0,
                  cursor: "pointer",
                  textAlign: "left",
                  background: code === currency ? "#333" : "transparent",
                  color: code === currency ? "#22c55e" : "white",
                }}
              >
                {code}
              </button>
            ))}
          </div>
        )}
      </div>

      <AuthBadge />
    </nav>
  );
}