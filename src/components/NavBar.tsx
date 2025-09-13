// src/components/NavBar.tsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Simple top navigation bar.
 * - Extracted as a component to keep App.tsx small and readable.
 * - Highlights the active route (very basic).
 */
export default function NavBar() {
  const { pathname } = useLocation();

  // Small helper to style the active link
  const linkStyle = (to: string): React.CSSProperties => ({
    marginRight: "1rem",
    textDecoration: pathname === to ? "underline" : "none",
    fontWeight: pathname === to ? 700 : 400,
  });

  return (
    <nav style={{ marginBottom: "1rem" }}>
      <Link to="/" style={linkStyle("/")}>
        Home
      </Link>
      <Link to="/about" style={linkStyle("/about")}>
        About
      </Link>
      <Link to="/health" style={linkStyle("/health")}>
        Health
      </Link>
    </nav>
  );
}
