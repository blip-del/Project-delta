import { OptionChainData, DteComparisonData } from "../types";

const clientCache = new Map<string, { timestamp: number; data: OptionChainData }>();
const CLIENT_CACHE_TTL = 60 * 1000; // 60s client cache

export async function fetchOptionsData(
  ticker: string,
  expirationTimestamp?: number
): Promise<OptionChainData> {
  const cleanTicker = ticker.trim().toUpperCase();
  const cacheKey = `${cleanTicker}_${expirationTimestamp || "default"}`;

  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
    return cached.data;
  }

  let url = `/api/options/${encodeURIComponent(cleanTicker)}`;
  if (expirationTimestamp) {
    url += `?date=${expirationTimestamp}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to fetch options for ${cleanTicker}`);
  }

  const data: OptionChainData = await response.json();
  clientCache.set(cacheKey, { timestamp: Date.now(), data });
  return data;
}

export async function fetchStrikeDteComparison(
  ticker: string,
  strike?: number,
  type: "CALL" | "PUT" = "CALL",
  limit: number = 10
): Promise<DteComparisonData> {
  const cleanTicker = ticker.trim().toUpperCase();
  let url = `/api/options/${encodeURIComponent(cleanTicker)}/strike-dte-comparison?type=${type}&limit=${limit}`;
  if (strike !== undefined && !isNaN(strike)) {
    url += `&strike=${strike}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error || `Failed to fetch DTE comparison for ${cleanTicker}`);
  }

  return await response.json();
}

export async function searchTickers(query: string) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

