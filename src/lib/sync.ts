// Two-way sync between this computer and the property's cloud account.
// Each computer keeps working offline; when online and signed in, newest change wins.
import { DATA_TABLES, db, type DataTable, type Row } from "@/lib/localdb";
import { getProperty } from "@/lib/property";

const ts = (r: Record<string, unknown> | undefined) => String(r?.["updated_at"] ?? r?.["created_at"] ?? "");

export type SyncResult = { sent: number; received: number; at: string };

async function client() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export async function cloudUser() {
  if (!navigator.onLine) return null;
  const sb = await client();
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function syncNow(): Promise<SyncResult> {
  if (!navigator.onLine) throw new Error("No internet right now.");
  const sb = await client();
  const user = await cloudUser();
  if (!user) throw new Error("Sign in to the cloud account first.");
  const code = (await getProperty()).code;
  if (!code) throw new Error("Set a property code in Settings first.");
  const d = db();

  const { data: cloud, error } = await sb.from("property_records").select("id, table_name, data, deleted").eq("property_code", code);
  if (error) throw error;
  const rows = cloud ?? [];
  const cloudMap = new Map(rows.map((c) => [`${c.table_name}:${c.id}`, c]));
  const deletions = new Map((await d.deletions.toArray()).map((x) => [`${x.table}:${x.id}`, x]));
  let received = 0;
  const outgoing: { id: string; owner_id: string; property_code: string; table_name: DataTable; data: Row | { updated_at: string }; deleted: boolean }[] = [];

  for (const table of DATA_TABLES) {
    const t = d[table];
    const local = new Map((await t.toArray()).map((r) => [r.id, r]));
    // Pull newer cloud changes
    for (const c of rows.filter((x) => x.table_name === table)) {
      const cData = c.data as Row & { updated_at?: string };
      const mine = local.get(c.id);
      const del = deletions.get(`${table}:${c.id}`);
      if (c.deleted) {
        if (mine && ts(mine) <= ts(cData)) { await t.delete(c.id); local.delete(c.id); received++; }
        continue;
      }
      if (del && del.deleted_at >= ts(cData)) continue;
      if (!mine || ts(mine) < ts(cData)) {
        if (table === "rooms") {
          // never two rooms with the same number
          for (const r of local.values()) if (r.id !== c.id && String(r["room_no"]).trim() === String(cData["room_no"]).trim()) { await t.delete(r.id); local.delete(r.id); }
        }
        await t.put({ ...cData, id: c.id });
        local.set(c.id, { ...cData, id: c.id });
        if (del) await d.deletions.delete(c.id);
        received++;
      }
    }
    // Push newer local changes
    for (const r of local.values()) {
      const c = cloudMap.get(`${table}:${r.id}`);
      if (!c || (!c.deleted && ts(c.data as Row) < ts(r))) outgoing.push({ id: r.id, owner_id: user.id, property_code: code, table_name: table, data: r, deleted: false });
    }
  }
  for (const [key, x] of deletions) {
    const c = cloudMap.get(key);
    if (c && !c.deleted) outgoing.push({ id: x.id, owner_id: user.id, property_code: code, table_name: x.table, data: { updated_at: x.deleted_at }, deleted: true });
  }
  for (let i = 0; i < outgoing.length; i += 200) {
    const batch = outgoing.slice(i, i + 200).map((o) => ({ ...o, data: JSON.parse(JSON.stringify(o.data)), updated_at: new Date().toISOString() }));
    const { error: e } = await sb.from("property_records").upsert(batch, { onConflict: "owner_id,property_code,table_name,id" });
    if (e) throw e;
  }
  const at = new Date().toISOString();
  await d.settings.put({ key: "last_sync", value: at });
  return { sent: outgoing.length, received, at };
}

export async function lastSync() {
  return ((await db().settings.get("last_sync"))?.value as string | undefined) ?? null;
}
