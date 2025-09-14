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
  retry?: {
    attempts?: number; // total tries incl. first (default 4)
    initialDelayMs?: number; // (default 400)
    maxDelayMs?: number; // (default 5000)
  };
}

/**
 * Read base URL from Vite env (must start with VITE_)
 * Example (development): VITE_API_BASE_URL=http://localhost:5000
 */
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "";

/** EN: Build absolute URL (or keep relative for mocks/previews). */
function buildUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/** ---------------- Retry helpers ------------------ */

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(headers: Headers): number | null {
  const ra = headers.get("Retry-After");
  if (!ra) return null;
  const secs = Number(ra);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(ra);
  if (!Number.isNaN(when)) {
    const delta = when - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function isRetrySafe(method: HttpMethod, path: string, hasBody: boolean): boolean {
  if (method === "GET") return true;
  const isRefresh = /\/api\/companies(\/refresh-profiles|\/[^/]+\/refresh-profile)\b/i.test(path);
  return method === "POST" && !hasBody && isRefresh;
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Custom Error type with status code */
interface HttpError extends Error {
  status?: number;
}

/**
 * Generic JSON fetch with:
 * - AbortController-based timeout
 * - JSON body serialization
 * - Error handling with server details
 * - Safe retries for 429/5xx (GET and body-less refresh POSTs)
 */
export async function fetchJson<TResponse = unknown, TBody = unknown>(
  options: FetchJsonOptions<TBody>,
): Promise<TResponse> {
  const { method = "GET", path, body, headers = {}, timeoutMs = 10_000, retry } = options;

  const url = buildUrl(path);
  const hasBody = body !== undefined && body !== null;

  const attempts = retry?.attempts ?? 4;
  const baseDelay = retry?.initialDelayMs ?? 400;
  const maxDelay = retry?.maxDelayMs ?? 5000;

  let lastErr: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (
        shouldRetryStatus(res.status) &&
        isRetrySafe(method, path, hasBody) &&
        attempt < attempts
      ) {
        const retryAfterMs = parseRetryAfter(res.headers);
        const backoff = Math.min(
          maxDelay,
          retryAfterMs ??
            Math.round(baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.25)),
        );
        clearTimeout(timer);
        await sleep(backoff);
        continue;
      }

      if (!res.ok) {
        try {
          type ErrorPayload = { message?: string; [k: string]: unknown };
          const maybeJson = (await res.json()) as ErrorPayload;
          const err: HttpError = new Error(
            `HTTP ${res.status} ${res.statusText} for ${method} ${path}` +
              (maybeJson.message ? ` — ${maybeJson.message}` : ` — ${JSON.stringify(maybeJson)}`),
          );
          err.status = res.status;
          throw err;
        } catch {
          const text = await res.text().catch(() => "");
          const err: HttpError = new Error(
            `HTTP ${res.status} ${res.statusText} for ${method} ${path}` +
              (text ? ` — ${text}` : ""),
          );
          err.status = res.status;
          throw err;
        }
      }

      const text = await res.text();
      clearTimeout(timer);
      return (text ? JSON.parse(text) : undefined) as TResponse;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;

      const isAbort = err instanceof DOMException && err.name === "AbortError";
      const isHttpError = typeof (err as { status?: number }).status === "number";
      const isNet = !isAbort && !isHttpError;

      if (
        (isAbort || isNet) &&
        isRetrySafe(method as HttpMethod, path, hasBody) &&
        attempt < attempts
      ) {
        const backoff = Math.min(
          maxDelay,
          Math.round(baseDelay * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.25)),
        );
        await sleep(backoff);
        continue;
      }

      throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
