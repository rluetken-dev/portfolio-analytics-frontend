import { useEffect, useState } from "react";

import { fetchJson } from "../services/api/client";

type HealthResponse = {
  status?: string;
};

export default function Health() {
  const [status, setStatus] = useState("loading...");
  const [error, setError] = useState<string | null>(null);
  const [usesFallback, setUsesFallback] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadHealthStatus = async () => {
      try {
        const response = await fetchJson<HealthResponse>({ path: "/health" });

        if (!isMounted) {
          return;
        }

        setStatus(response.status ?? "unknown");
        setError(null);
        setUsesFallback(false);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("unavailable");
        setError(error instanceof Error ? error.message : "Health check failed.");
        setUsesFallback(true);
      }
    };

    void loadHealthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main>
      <h1>Health Check</h1>

      <p>
        Status: <strong>{status}</strong>
        {usesFallback && <span style={{ marginLeft: 8, color: "gray" }}>backend unreachable</span>}
      </p>

      {error && <p style={{ color: "red", marginTop: "0.5rem" }}>Error: {error}</p>}
    </main>
  );
}