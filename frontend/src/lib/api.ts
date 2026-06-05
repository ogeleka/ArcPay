const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus = "pending" | "paid" | "released" | "refunded" | "expired";

export interface PaymentDetails {
  payment_id:       string;
  amount:           string;
  amount_ngn:       number | null;
  rate:             number | null;
  markup_bps:       number;
  mid_rate:         number | null;
  currency:         string;
  status:           PaymentStatus;
  expires_at:       string | null;
  payer:            string | null;
  order_id:         string | null;
  merchant_name:    string;
  merchant_address: string;
  arcpay_address:   string;
  usdc_address:     string;
}

export interface MerchantProfile {
  id:                string;
  name:              string;
  email:             string;
  wallet_address:    string;
  webhook_url:       string | null;
  webhook_secret:    string | null;
  markup_bps:        number;
  default_currency:  string;
  business_type:     string | null;
  website:           string | null;
  use_case:          string | null;
  usdc_balance:      string | null;
  total_payments:    number;
  total_volume_usdc: string;
}

export interface Payment {
  id:          string;
  amount:      number;
  currency:    string;
  amount_ngn:  number | null;
  rate:        number | null;
  markup_bps:  number | null;
  status:      PaymentStatus;
  order_id:    string | null;
  payer:       string | null;
  tx_hash:     string | null;
  paid_at:     string | null;
  expires_at:  string | null;
  created_at:  string;
  updated_at:  string;
}

export interface PaymentList {
  data:     Payment[];
  page:     number;
  limit:    number;
  total:    number;
  has_more: boolean;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeader(token: string) {
  return { "Authorization": `Bearer ${token}` };
}

async function apiGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? authHeader(token) : {},
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

async function apiPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeader(token) : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

async function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeader(token) : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// ── Auth (no token needed) ────────────────────────────────────────────────────

export const register = (body: {
  name: string;
  email: string;
  wallet_address: string;
  password: string;
  webhook_url?: string;
  business_type?: string;
  website?: string;
  use_case?: string;
  default_currency?: string;
  markup_bps?: number;
}) =>
  apiPost<{ token: string; merchant_id: string; api_key: string; webhook_secret: string }>(
    "/auth/register", body
  );

export const login = (email: string, password: string) =>
  apiPost<{ token: string }>("/auth/login", { email, password });

// ── Wallet sign-in (SIWE-style) ───────────────────────────────────────────────

export const walletNonce = (address: string) =>
  apiPost<{ nonce: string; message: string }>("/auth/wallet/nonce", { address });

export const walletLogin = (address: string, signature: string) =>
  apiPost<{ token: string }>("/auth/wallet/login", { address, signature });

// ── Public ────────────────────────────────────────────────────────────────────

export const getPayment = (id: string) =>
  apiGet<PaymentDetails>(`/api/pay/${id}`);

// ── Authenticated (JWT token required) ───────────────────────────────────────

export const getMe = (token: string) =>
  apiGet<MerchantProfile>("/merchants/me", token);

export const listPayments = (token: string, status = "all", page = 1, limit = 25, q = "") =>
  apiGet<PaymentList>(`/payments?status=${status}&page=${page}&limit=${limit}${q ? `&q=${encodeURIComponent(q)}` : ""}`, token);

export const createPayment = (
  token: string,
  body: { amount: number; currency?: string; order_id?: string }
) => apiPost<{ payment_id: string; payment_url: string; amount_usdc: string; amount_ngn: number | null }>(
  "/payments", body, token
);

export const testWebhook = (token: string) =>
  apiPost<{ delivered: boolean; message: string }>("/merchants/me/webhook-test", {}, token);

export const rotateKey = (token: string) =>
  apiPost<{ api_key: string; message: string }>("/merchants/me/rotate-key", {}, token);

export const updateWebhookUrl = (token: string, webhook_url: string) =>
  apiPatch<{ updated: boolean }>("/merchants/me", { webhook_url }, token);

export const updateMerchant = (token: string, body: Partial<{
  name: string; email: string; wallet_address: string;
  webhook_url: string; markup_bps: number; default_currency: string;
}>) => apiPatch<{ updated: boolean }>("/merchants/me", body, token);

export const changePassword = (token: string, current_password: string, new_password: string) =>
  apiPost<{ updated: boolean }>("/auth/change-password", { current_password, new_password }, token);
