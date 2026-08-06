import type {
  LatestMetric,
  PriceApiResponse,
  PriceObjectResponse,
  PriceWrappedResponse,
} from "../../types/analytics";
import { fetchJson } from "./client";

function isPriceObject(value: unknown): value is PriceObjectResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    "close" in row ||
    "adjustedClose" in row ||
    "price" in row ||
    "value" in row ||
    "latest" in row ||
    "date" in row ||
    "tradingDate" in row ||
    "asOf" in row
  );
}

function isWrappedPrice(value: unknown): value is PriceWrappedResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;

  return (
    ("data" in row && isPriceObject(row.data)) ||
    ("result" in row && isPriceObject(row.result)) ||
    ("item" in row && isPriceObject(row.item))
  );
}

function unwrapPrice(response: PriceApiResponse): PriceObjectResponse | null {
  if (typeof response === "number") {
    return null;
  }

  if (isWrappedPrice(response)) {
    if ("data" in response && response.data) {
      return response.data;
    }

    if ("result" in response && response.result) {
      return response.result;
    }

    if ("item" in response && response.item) {
      return response.item;
    }
  }

  return isPriceObject(response) ? response : null;
}

function pickPriceValue(price: PriceObjectResponse) {
  if (typeof price.adjustedClose === "number") {
    return { value: price.adjustedClose, adjusted: true };
  }

  if (typeof price.price === "number") {
    return { value: price.price, adjusted: false };
  }

  if (typeof price.value === "number") {
    return { value: price.value, adjusted: false };
  }

  if (typeof price.latest === "number") {
    return { value: price.latest, adjusted: false };
  }

  if (typeof price.close === "number") {
    return { value: price.close, adjusted: false };
  }

  return { value: null, adjusted: false };
}

function pickDate(price: PriceObjectResponse) {
  if (typeof price.tradingDate === "string") {
    return price.tradingDate;
  }

  if (typeof price.asOf === "string") {
    return price.asOf;
  }

  if (typeof price.date === "string") {
    return price.date;
  }

  return undefined;
}

export async function getLatestPrice(symbol: string): Promise<LatestMetric<number>> {
  const normalizedSymbol = symbol.trim().toUpperCase();

  if (!normalizedSymbol) {
    return { symbol: normalizedSymbol, value: null };
  }

  try {
    const response = await fetchJson<PriceApiResponse>({
      path: `/api/analytics/price?symbol=${encodeURIComponent(normalizedSymbol)}`,
    });

    if (typeof response === "number") {
      return {
        symbol: normalizedSymbol,
        value: response,
        unit: "USD",
        adjusted: false,
      };
    }

    const price = unwrapPrice(response);

    if (!price) {
      return {
        symbol: normalizedSymbol,
        value: null,
        unit: "USD",
        adjusted: false,
      };
    }

    const { value, adjusted } = pickPriceValue(price);

    return {
      symbol: normalizedSymbol,
      value,
      asOf: pickDate(price),
      unit: typeof price.currency === "string" ? price.currency : "USD",
      adjusted,
      source: typeof price.source === "string" ? price.source : undefined,
    };
  } catch {
    return { symbol: normalizedSymbol, value: null };
  }
}