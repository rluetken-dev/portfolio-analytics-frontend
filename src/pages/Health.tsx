// src/pages/Health.tsx
import { useEffect, useState } from "react";
import { fetchJson } from "../services/api/client";

export default function Health() {
  // UI state for the health status and potential errors
  const [status, setStatus] = useState<string>("loading...");
  const [error, setError] = useState<string | null>(null);
  const [usedMock, setUsedMock] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true; // guard to avoid setting state after unmount

    // IIFE to use async/await inside useEffect
    (async () => {
      try {
        // Call real backend: expected JSON like { "status": "ok" }
        const res = await fetchJson<{ status: string }>({ path: "/health" });
        if (!isMounted) return;
        setStatus(res?.status ?? "unknown");
      } catch (err) {
        // If the real call fails (offline, CORS, wrong port, etc.),
        // we present a friendly message and fall back to a mock value.
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);

        // --- Mock fallback (keeps the page useful during dev) ---
        // Note: This is deliberately simple; we can later gate by env var if desired.
        setUsedMock(true);
        setStatus("ok (mock)");
      }
    })();

    return () => {
      // cleanup flag so we don't update state after unmount
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <h2>🩺 Health Check</h2>

      {/* Primary status display (real or mock) */}
      <p>
        Status: <strong>{status}</strong>
        {usedMock && (
          <span style={{ marginLeft: 8, color: "gray" }}>
            {/* Tell developers that this is a mock, not the real backend */}
            — using mock (backend unreachable)
          </span>
        )}
      </p>

      {/* Optional: show error details for developers */}
      {error && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>
          Error: {error}
        </p>
      )}
    </div>
  );
}
