// src/components/NavBar.tsx
import { Link, useLocation, useMatch } from "react-router-dom";
import { AuthBadge } from "./AuthBadge";

/**
 * Simple top navigation bar.
 * - Keeps static top-level links clean.
 * - Shows a contextual "Company: SYM" chip only on /company/:symbol.
 */
export default function NavBar() {
  const { pathname } = useLocation();

  // Match dynamic detail route like /company/AAPL
  const match = useMatch("/company/:symbol");
  const sym = match?.params.symbol?.toUpperCase(); // normalize for display

  // Basic active-link styling
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
      {/* Left: static nav links */}
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

      {/* Spacer pushes the right content to the far end */}
      <div style={{ flex: 1 }} />

      {/* Right: show current company chip (if any) */}
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

      {/* 🔹 Always show AuthBadge at the far right */}
      <AuthBadge />
    </nav>
  );
}
