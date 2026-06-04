/**
 * CommonJS FX bridge for the backend.
 * Tries the ngn/ micro-service first (http://localhost:3002/rate),
 * falls back to per-currency FALLBACK env vars, then to last cached value.
 * Never throws.
 */

// Supported fiat currencies — add new ones here; no other code change needed
const CURRENCIES = {
  NGN: { symbol: "₦", name: "Nigerian Naira",   fallbackEnv: "NGN_FALLBACK_RATE" },
  GHS: { symbol: "₵", name: "Ghanaian Cedi",    fallbackEnv: "GHS_FALLBACK_RATE" },
  KES: { symbol: "KSh", name: "Kenyan Shilling", fallbackEnv: "KES_FALLBACK_RATE" },
  ZAR: { symbol: "R",  name: "South African Rand", fallbackEnv: "ZAR_FALLBACK_RATE" },
  USD: { symbol: "$",  name: "US Dollar",          fallbackEnv: "USD_FALLBACK_RATE" },
};

const NGN_SVC   = process.env.NGN_SERVICE_URL || "http://localhost:3002";
const CACHE_TTL = 60_000;

// Per-currency cache: { [code]: { rate, fetchedAt } }
const cache = {};

async function getRateForCurrency(code) {
  const upper = code?.toUpperCase() ?? "NGN";
  if (!CURRENCIES[upper]) throw new Error(`Unsupported currency: ${upper}`);

  const now = Date.now();
  const hit  = cache[upper];
  if (hit?.rate !== null && hit?.rate !== undefined && now - hit.fetchedAt < CACHE_TTL) {
    return { rate: hit.rate, stale: false };
  }

  try {
    // The NGN micro-service fetches all currency rates from open.er-api.com
    // We ask it for the specific currency key
    const res = await fetch(`${NGN_SVC}/rate?currency=${upper}`, { signal: AbortSignal.timeout(3_000) });
    if (res.ok) {
      const data = await res.json();
      const rate = data.usdToNgn ?? data.rate ?? null; // service may return either key
      if (rate) {
        cache[upper] = { rate, fetchedAt: now };
        return { rate, stale: false };
      }
    }
  } catch { /* fall through to env fallback */ }

  // Env fallback — each currency only uses ITS OWN fallback (never cross-default to NGN)
  let envRate = parseFloat(process.env[CURRENCIES[upper].fallbackEnv]);
  if (isNaN(envRate) && upper === "USD") envRate = 1; // USD ≈ USDC
  if (!isNaN(envRate) && envRate > 0) return { rate: envRate, stale: true };
  if (cache[upper]?.rate) return { rate: cache[upper].rate, stale: true };
  return { rate: null, stale: true };
}

// Keep the old getNgnRate signature so existing callers don't break
async function getNgnRate() { return getRateForCurrency("NGN"); }

/** fiat (whole units) → USDC base units, rounded UP */
function fiatToUsdc(localAmount, rate) {
  return Math.ceil((localAmount / rate) * 1_000_000);
}

/** USDC base units → whole fiat units */
function usdcToFiat(usdcBaseUnits, rate) {
  return Math.round((usdcBaseUnits / 1_000_000) * rate);
}

// Keep old names as aliases so nothing else breaks
const ngnToUsdc = fiatToUsdc;
const usdcToNgn = usdcToFiat;

module.exports = {
  getNgnRate, getRateForCurrency,
  ngnToUsdc, usdcToNgn,
  fiatToUsdc, usdcToFiat,
  CURRENCIES,
};
