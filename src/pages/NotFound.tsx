// src/pages/NotFound.tsx
import React from "react";
import { Link } from "react-router-dom";

/**
 * Simple 404 page for unknown routes.
 * Keeps users oriented and provides a quick way back home.
 */
export default function NotFound() {
  return (
    <div>
      <h2>🚫 404 – Page Not Found</h2>
      <p>The page you were looking for does not exist.</p>
      <p>
        <Link to="/">Go back to Home</Link>
      </p>
    </div>
  );
}
