import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useMatch } from "react-router-dom";
import { AuthBadge } from "./AuthBadge";
import { useCurrency } from "../hooks/useCurrency";
import type { CurrencyCode } from "../types/currency";

/**
 * Top navigation bar.
 * - Static navigation links
 * - Dynamic company chip (on /company/:symbol)
 * - Global currency switcher with persistent state
 */
export default function NavBar() {
  const { pathname } = useLocation();
  const { currency, setCurrency } = useCurrency();

  // --- Dropdown logic for currency menu ---
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

        {open && (
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
