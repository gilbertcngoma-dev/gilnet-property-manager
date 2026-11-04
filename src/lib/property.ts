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

export const isValidCode = (c: string) => /^[A-Z]{3,8}$/.test(c);

/** Receipt numbers look like {CODE}-0001, typed from the receipt book. */
export const formatReceipt = (code: string, n: number) => `${code ? code + "-" : ""}${String(Math.max(1, n)).padStart(4, "0")}`;

type WithReceipt = { id?: string; receipt_no?: string | null };

/** Next unused receipt number for this property across stays and restaurant sales. */
export function suggestReceiptNo(code: string, ...lists: WithReceipt[][]): string {
  let max = 0;
  const re = new RegExp(`^(?:${code}-)?(\\d+)$`, "i");
  for (const list of lists)
    for (const r of list) {
      const m = re.exec((r.receipt_no ?? "").trim());
      if (m) max = Math.max(max, parseInt(m[1] ?? "0", 10));
    }
  return formatReceipt(code, max + 1);
}

/** True when another record already uses this receipt number (case-insensitive). */
export function receiptTaken(no: string, excludeId: string | undefined, ...lists: WithReceipt[][]): boolean {
  const needle = no.trim().toUpperCase();
  if (!needle) return false;
  for (const list of lists)
    for (const r of list)
      if (r.id !== excludeId && (r.receipt_no ?? "").trim().toUpperCase() === needle) return true;
  return false;
}
