import { OptionChainData } from "../types";

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

export async function searchTickers(query: string) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
