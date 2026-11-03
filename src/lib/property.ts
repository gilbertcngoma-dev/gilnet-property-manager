// Property identity (set once in the setup wizard) and receipt-number helpers.
// Everything is stored on this device in the local database.
import { db } from "@/lib/localdb";

export type Property = { name: string; code: string; address: string };

export async function getProperty(): Promise<Property | null> {
  const v = (await db().settings.get("property"))?.value as Property | undefined;
  return v && v.name ? v : null;
}

export async function saveProperty(p: Property) {
  await db().settings.put({ key: "property", value: p });
}

/** Receipt numbers are plain zero-padded numbers: 0001, 0002, … */
export const formatReceipt = (n: number) => String(Math.max(1, n)).padStart(4, "0");

type WithReceipt = { id?: string; receipt_no?: string | null };

/** Next unused receipt number across stays and restaurant sales. */
export function suggestReceiptNo(...lists: WithReceipt[][]): string {
  let max = 0;
  for (const list of lists)
    for (const r of list) {
      const m = /^(\d+)$/.exec((r.receipt_no ?? "").trim());
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  return formatReceipt(max + 1);
}

/** True when no other record already uses this receipt number. */
export function receiptTaken(no: string, excludeId: string | undefined, ...lists: WithReceipt[][]): boolean {
  const needle = no.trim();
  if (!needle) return false;
  for (const list of lists)
    for (const r of list)
      if (r.id !== excludeId && (r.receipt_no ?? "").trim() === needle) return true;
  return false;
}
