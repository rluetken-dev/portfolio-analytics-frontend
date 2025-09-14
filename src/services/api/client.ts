// src/services/api/client.ts

/**
 * Small, typed helper around fetch() for our frontend API calls.
 * Centralizes the base URL, timeouts, headers, and error handling.
 */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface FetchJsonOptions<TBody = unknown> {
  method?: HttpMethod;
  path: string; // e.g. "/health" or "/api/companies"
  body?: TBody; // will be JSON-stringified if provided
  headers?: Record<string, string>;
  timeoutMs?: number; // default timeout for slow requests
}

/**
 * Read base URL from Vite env (must start with VITE_)
 * Example (development): VITE_API_BASE_URL=http://localhost:5000
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "";

/**
 * Basic guard to ensure base URL is set when required.
 * We don't throw immediately to keep the function reusable for relative mocks.
 */
function buildUrl(path: string): string {
  // Ensure path starts with a single slash
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  // If API_BASE_URL is empty, fall back to relative (useful in preview/mocks)
  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Generic JSON fetch with:
 * - AbortController-based timeout
 * - JSON body serialization
 * - Basic error handling with helpful messages
 */
export async function fetchJson<TResponse = unknown, TBody = unknown>(
  options: FetchJsonOptions<TBody>,
): Promise<TResponse> {
  const {
    method = "GET",
    path,
    body,
    headers = {},
    timeoutMs = 10_000, // 10s default timeout
  } = options;

  const url = buildUrl(path);

  // Setup an abortable timeout to avoid hanging requests
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isJsonBody = body !== undefined && body !== null;

    const res = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: isJsonBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    // Non-2xx responses are treated as errors with details if possible
    if (!res.ok) {
      let errText: string | undefined;
      try {
        // Try to parse server-provided error message first
        const maybeJson = await res.json();
        errText =
          typeof maybeJson?.message === "string" ? maybeJson.message : JSON.stringify(maybeJson);
      } catch {
        // Fall back to plain text
        errText = await res.text().catch(() => undefined);
      }

      throw new Error(
        `HTTP ${res.status} ${res.statusText} for ${method} ${path}` +
          (errText ? ` — ${errText}` : ""),
      );
    }

    // Attempt to parse JSON; if empty body, return undefined as any
    const text = await res.text();
    if (!text) return undefined as TResponse;

    // Parse JSON response
    return JSON.parse(text) as TResponse;
  } catch (err: unknown) {
    // Provide a concise, developer-friendly error
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${method} ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
