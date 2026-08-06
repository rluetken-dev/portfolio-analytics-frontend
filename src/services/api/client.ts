import { clearAccessToken, getAccessToken, setAccessToken } from "../../utils/token";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface FetchJsonOptions<TBody = unknown> {
  method?: HttpMethod;
  path: string;
  body?: TBody;
  headers?: Record<string, string>;
  timeoutMs?: number;
  retry?: {
    attempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  };
}

export interface HttpError extends Error {
  status?: number;
  title?: string;
  detail?: string;
  traceId?: string;
}

type ProblemDetails = {
  title?: string;
  detail?: string;
  status?: number;
  traceId?: string;
  message?: string;
};

type RefreshResponse = {
  accessToken: string;
};

const apiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") || "";

function buildUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiBase}${normalizedPath}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get("Retry-After");

  if (!retryAfter) {
    return null;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const timestamp = Date.parse(retryAfter);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, timestamp - Date.now());
}

function shouldRetryStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetrySafe(method: HttpMethod, path: string, hasBody: boolean) {
  if (method === "GET") {
    return true;
  }

  const isRefreshProfileRequest = /\/api\/companies(\/refresh-profiles|\/[^/]+\/refresh-profile)\b/i.test(
    path,
  );

  return method === "POST" && !hasBody && isRefreshProfileRequest;
}

function createHttpError(message: string, status?: number): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

async function parseErrorResponse(response: Response): Promise<HttpError> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await response.json().catch(() => null)) as ProblemDetails | null;

    if (data && typeof data === "object") {
      const error = createHttpError(
        data.detail ?? data.message ?? data.title ?? `HTTP ${response.status}`,
        data.status ?? response.status,
      );

      error.title = data.title;
      error.detail = data.detail;
      error.traceId = data.traceId;

      return error;
    }
  }

  const text = await response
    .text()
    .catch(() => "")
    .then((value) => value.trim());

  return createHttpError(text || `HTTP ${response.status}`, response.status);
}

async function refreshAccessToken() {
  const response = await fetch(buildUrl("/api/User/refresh"), {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    clearAccessToken();
    throw createHttpError("Unauthorized and refresh failed.", 401);
  }

  const data = (await response.json()) as RefreshResponse;
  setAccessToken(data.accessToken);
}

function getBackoffDelayMs(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  retryAfterMs?: number | null,
) {
  if (retryAfterMs != null) {
    return Math.min(maxDelayMs, retryAfterMs);
  }

  return Math.min(
    maxDelayMs,
    Math.round(initialDelayMs * Math.pow(2, attempt - 1) * (1 + Math.random() * 0.25)),
  );
}

export async function fetchJson<TResponse = unknown, TBody = unknown>(
  options: FetchJsonOptions<TBody>,
): Promise<TResponse> {
  const {
    method = "GET",
    path,
    body,
    headers = {},
    timeoutMs = 10_000,
    retry,
  } = options;

  const hasBody = body !== undefined && body !== null;
  const attempts = retry?.attempts ?? 4;
  const initialDelayMs = retry?.initialDelayMs ?? 400;
  const maxDelayMs = retry?.maxDelayMs ?? 5000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const token = getAccessToken();

      const response = await fetch(buildUrl(path), {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
        },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (
        shouldRetryStatus(response.status) &&
        isRetrySafe(method, path, hasBody) &&
        attempt < attempts
      ) {
        window.clearTimeout(timeoutId);

        const delayMs = getBackoffDelayMs(
          attempt,
          initialDelayMs,
          maxDelayMs,
          parseRetryAfter(response.headers),
        );

        await sleep(delayMs);
        continue;
      }

      if (response.status === 401 && !path.includes("/api/User/login")) {
        await refreshAccessToken();

        return fetchJson<TResponse, TBody>({
          method,
          path,
          body,
          headers,
          timeoutMs,
          retry,
        });
      }

      if (!response.ok) {
        throw await parseErrorResponse(response);
      }

      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as TResponse;
    } catch (error) {
      lastError = error;

      const isAbortError = error instanceof DOMException && error.name === "AbortError";
      const isHttpError = typeof (error as { status?: number }).status === "number";
      const isNetworkError = !isAbortError && !isHttpError;

      if ((isAbortError || isNetworkError) && isRetrySafe(method, path, hasBody) && attempt < attempts) {
        const delayMs = getBackoffDelayMs(attempt, initialDelayMs, maxDelayMs);
        await sleep(delayMs);
        continue;
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}