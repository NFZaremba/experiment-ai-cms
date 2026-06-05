import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Simulate network latency in mock mode */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Capitalize the first letter of a string */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Extract a display first name from the backend's `fullName` field.
 *
 * The backend currently sends a period-separated identifier
 * (e.g. "john.johnny" or "john.johnny@iwbi.org"). This function is the
 * single source of truth for that parsing — update it here if the
 * backend convention changes.
 *
 * Handles:
 *   "john.johnny"           → "John"
 *   "john.johnny@iwbi.org"  → "John"
 *   "John Smith"            → "John"
 *   "" / null / undefined   → fallback
 */
export function parseFirstName(
  fullName: string | null | undefined,
  fallback = "there"
): string {
  const raw = fullName?.trim();
  if (!raw) return fallback;
  const beforeAt = raw.includes("@") ? raw.split("@")[0] : raw;
  const firstSegment = beforeAt.split(/[.\s]/)[0];
  return firstSegment ? capitalize(firstSegment) : fallback;
}
