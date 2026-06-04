/**
 * fx.js — Live multi-currency FX rates (USD base).
 *
 * open.er-api.com returns ALL rates in one call — we cache the whole
 * rates object for 60 s and serve any currency from it at zero extra cost.
 */

const FX_URL        = "https://open.er-api.com/v6/latest/USD";
const CACHE_TTL     = 60_000;
const FETCH_TIMEOUT = 5_000;

// Supported currencies + their env fallback key
export const SUPPORTED = {
  NGN: { name: "Nigerian Naira",    symbol: "₦",   fallbackEnv: "NGN_FALLBACK_RATE" },
  GHS: { name: "Ghanaian Cedi",     symbol: "₵",   fallbackEnv: "GHS_FALLBACK_RATE" },
  KES: { name: "Kenyan Shilling",   symbol: "KSh", fallbackEnv: "KES_FALLBACK_RATE" },
  ZAR: { name: "South African Rand",symbol: "R",   fallbackEnv: "ZAR_FALLBACK_RATE" },
  USD: { name: "US Dollar",         symbol: "$",   fallbackEnv: "USD_FALLBACK_RATE" },
};

// Whole rates map — populated on first fetch
let cache = { rates: null, fetchedAt: null };

async function fetchAll() {
  const now = Date.now();
  if (cache.rates && now - cache.fetchedAt < CACHE_TTL) return cache.rates;

  try {
    const res = await fetch(FX_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.rates) throw new Error("rates field missing");
    cache = { rates: data.rates, fetchedAt: now };
    return data.rates;
  } catch (err) {
    console.error("[fx] live fetch failed:", err.message);
    return null;
  }
}

/**
 * Get the USD→<currency> rate.
 * Falls back to <CURRENCY>_FALLBACK_RATE env var, then stale cache.
 */
export async function getRate(currency = "NGN") {
  const code = currency.toUpperCase();
  if (!SUPPORTED[code]) throw new Error(`Unsupported currency: ${code}`);

  const rates = await fetchAll();
  const live  = rates?.[code];

  if (typeof live === "number") {
    return { rate: live, stale: false, fetchedAt: new Date(cache.fetchedAt).toISOString() };
  }

  // Env fallback
  const envRate = parseFloat(process.env[SUPPORTED[code].fallbackEnv]);
  if (!isNaN(envRate) && envRate > 0) return { rate: envRate, stale: true, fetchedAt: null };

  // Stale cache
  const staleRate = cache.rates?.[code];
  if (staleRate) return { rate: staleRate, stale: true, fetchedAt: new Date(cache.fetchedAt).toISOString() };

  return { rate: null, stale: true, fetchedAt: null };
}

// Keep old export so nothing else breaks
export const getNgnRate = () => getRate("NGN");
