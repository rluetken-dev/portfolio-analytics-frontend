// src/pages/Health.tsx
import React, { useEffect, useState } from "react";
import { fetchJson } from "../services/api/client";

export default function Health() {
  // State for loading and result
  const [status, setStatus] = useState<string>("loading...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Call /health endpoint on mount
    fetchJson<{ status: string }>({ path: "/health" })
      .then((res) => {
        // Expect a JSON like { status: "ok" }
        setStatus(res.status);
      })
      .catch((err) => {
        // Show error message if fetch fails
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  return (
    <div>
      <h2>🩺 Health Check</h2>
      {error ? (
        <p style={{ color: "red" }}>Error: {error}</p>
      ) : (
        <p>Status: {status}</p>
      )}
    </div>
  );
}
