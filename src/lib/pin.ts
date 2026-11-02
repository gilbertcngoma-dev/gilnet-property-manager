import { useSyncExternalStore } from "react";
import { db } from "@/lib/localdb";
import type { AppRole } from "@/lib/lodge";

/** PINs are stored on this device only, as SHA-256 hashes. */
export type PinMap = Partial<Record<AppRole, string>>;
const KEY = "lodge-session-role";

export async function hashPin(pin: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("chaniche:" + pin));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getPins(): Promise<PinMap> {
  return ((await db().settings.get("pins"))?.value as PinMap) ?? {};
}

export async function setPin(role: AppRole, pin: string | null) {
  const pins = await getPins();
  if (pin) pins[role] = await hashPin(pin); else delete pins[role];
  await db().settings.put({ key: "pins", value: pins });
}

export const isValidPin = (pin: string) => /^\d{4,8}$/.test(pin);

/** Returns the department a PIN opens, or null. Manager PIN wins if two match. */
export async function roleForPin(pin: string): Promise<AppRole | null> {
  const h = await hashPin(pin);
  const pins = await getPins();
  const order: AppRole[] = ["admin", "staff", "housekeeping", "restaurant"];
  return order.find((r) => pins[r] === h) ?? null;
}

const listeners = new Set<() => void>();
export function setSessionRole(role: AppRole | null) {
  if (role) sessionStorage.setItem(KEY, role); else sessionStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}
export function useSessionRole() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => sessionStorage.getItem(KEY) as AppRole | null,
    () => null,
  );
}
