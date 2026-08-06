import { useEffect, useState } from "react";

type HealthState = "loading" | "ok" | "unavailable";

type HealthResponse = {
  status?: string;
};

export default function Health() {
  const [status, setStatus] = useState<HealthState>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch("/health", {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as HealthResponse;

        if (!cancelled) {
          setStatus(data.status === "ok" ? "ok" : "unavailable");
          setError(null);
        }
      } catch (healthError) {
        if (!cancelled) {
          setStatus("unavailable");
          setError(healthError instanceof Error ? healthError.message : String(healthError));
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h2>Health Check</h2>

      <p>
        Status: <strong>{status}</strong>
      </p>

      {error && <p style={{ color: "red", marginTop: "0.5rem" }}>Error: {error}</p>}
    </div>
  );
}