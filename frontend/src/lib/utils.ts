import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui class utility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** USDC base units (6 decimals) → human string e.g. "2.00 USDC" */
export function fmtUsdc(baseUnits: bigint | number | string): string {
  return (Number(baseUnits) / 1_000_000).toFixed(2) + " USDC";
}

/** Whole NGN → "₦4,500" */
export function fmtNgn(ngn: number | null | undefined): string {
  if (ngn == null) return "";
  return "₦" + ngn.toLocaleString("en-NG");
}

/** Seconds remaining until a date string */
export function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/** Truncate an address: 0x1234...abcd */
export function truncAddr(addr: string, chars = 4): string {
  return `${addr.slice(0, chars + 2)}...${addr.slice(-chars)}`;
}
