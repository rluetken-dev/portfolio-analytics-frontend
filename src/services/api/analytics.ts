import { fetchJson } from "./client";
import type {
  LatestMetric,
  PriceApiResponse,
  PriceObjectResponse,
  PriceWrappedResponse,
} from "../../types/analytics";

/** Narrow: is plain object with possible price fields */
function isPriceObject(x: unknown): x is PriceObjectResponse {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  // heuristic: any of the known fields exists
  return (
    "close" in o ||
    "adjustedClose" in o ||
    "price" in o ||
    "value" in o ||
    "latest" in o ||
    "date" in o ||
    "tradingDate" in o ||
    "asOf" in o
  );
}

/** Narrow: is a known wrapper shape like { data: {...} } */
function isWrappedPrice(x: unknown): x is PriceWrappedResponse {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    ("data" in o && isPriceObject(o.data)) ||
    ("result" in o && isPriceObject(o.result)) ||
    ("item" in o && isPriceObject(o.item))
  );
}

/** Unwrap to the inner PriceObjectResponse if wrapped; otherwise return object directly. */
function unwrapPrice(res: PriceApiResponse): PriceObjectResponse | null {
  if (typeof res === "number") return null;
  if (isWrappedPrice(res)) {
    if ("data" in res && res.data) return res.data;
    if ("result" in res && res.result) return res.result;
    if ("item" in res && res.item) return res.item;
  }
  if (isPriceObject(res)) return res;
  return null;
}

export async function getLatestPrice(symbol: string): Promise<LatestMetric<number>> {
  const sym = (symbol ?? "").trim().toUpperCase();
  if (!sym) return { symbol: sym, value: null };

  try {
    const res = await fetchJson<PriceApiResponse>({
      // Build the query string yourself; only 'path' is used by your fetchJson
      path: `/api/analytics/price?symbol=${encodeURIComponent(sym)}`,
    });

    // one-time debug log to verify the raw shape (safe to keep during dev)
    // You can remove this later.
    console.log("[analytics] raw price response", res);

    let value: number | null = null;
    let asOf: string | undefined;
    let adjusted = false;
    let source: string | undefined;
    let unit: string | undefined;

    if (typeof res === "number") {
      value = res;
    } else {
      const obj = unwrapPrice(res);
      if (obj) {
        if (typeof obj.adjustedClose === "number") {
          value = obj.adjustedClose;
          adjusted = true;
        } else if (typeof obj.price === "number") {
          value = obj.price;
        } else if (typeof obj.value === "number") {
          value = obj.value;
        } else if (typeof obj.latest === "number") {
          value = obj.latest;
        } else if (typeof obj.close === "number") {
          value = obj.close; // <-- your backend returns "close"
        }

        if (typeof obj.tradingDate === "string") asOf = obj.tradingDate;
        else if (typeof obj.asOf === "string") asOf = obj.asOf;
        else if (typeof obj.date === "string") asOf = obj.date;

        if (typeof obj.source === "string") source = obj.source;
        if (typeof obj.currency === "string") unit = obj.currency;
      }
    }

    if (!unit) unit = "USD";

    return { symbol: sym, value, asOf, unit, adjusted, source };
  } catch (err) {
    console.error("[analytics] getLatestPrice failed:", err);
    return { symbol: sym, value: null };
  }
}
