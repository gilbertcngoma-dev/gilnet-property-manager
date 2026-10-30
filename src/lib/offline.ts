import Dexie, { type EntityTable } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QueuedWrite = {
  id?: number;
  table: "stays" | "restaurant_sales" | "rooms";
  op: "insert" | "update";
  payload: Record<string, unknown>;
  match?: Record<string, unknown>;
  created_at: number;
};

type LocalRow = Record<string, unknown> & { id: string };

class LodgeDB extends Dexie {
  stays!: EntityTable<LocalRow, "id">;
  syncQueue!: EntityTable<QueuedWrite, "id">;
  constructor() {
    super("chaniche-lodge");
    this.version(1).stores({ stays: "id, room_no, check_in", syncQueue: "++id, created_at" });
  }
}

let _db: LodgeDB | null = null;
export function getDb() {
  if (typeof window === "undefined") throw new Error("offline db is browser-only");
  if (!_db) _db = new LodgeDB();
  return _db;
}

async function push(item: QueuedWrite) {
  const table = supabase.from(item.table);
  return item.op === "insert"
    ? table.insert(item.payload)
    : table.update(item.payload).match(item.match ?? {});
}

/** Process queued writes in order (last-write-wins by queue order). Returns number synced. */
export async function processSyncQueue() {
  const db = getDb();
  const items = await db.syncQueue.orderBy("created_at").toArray();
  let synced = 0;
  for (const item of items) {
    const { error } = await push(item);
    if (error) break; // keep order; retry on next online event
    await db.syncQueue.delete(item.id!);
    synced++;
  }
  return synced;
}

/** Save a check-in locally first, then try the server; queue it if offline or the write fails. */
export async function insertStayOfflineFirst(row: Record<string, unknown>) {
  const db = getDb();
  const id = crypto.randomUUID();
  const local = { ...row, id };
  await db.stays.put(local);
  const enqueue = () => db.syncQueue.add({ table: "stays", op: "insert", payload: local, created_at: Date.now() });
  if (!navigator.onLine) {
    await enqueue();
    return { queued: true as const, id };
  }
  const { error } = await supabase.from("stays").insert(local);
  if (error) {
    await enqueue();
    return { queued: true as const, id };
  }
  return { queued: false as const, id };
}

/** Mark a room status; queued when offline so it syncs later. */
export async function updateRoomOfflineFirst(roomNo: string, status: string) {
  const payload = { status };
  if (!navigator.onLine) {
    await getDb().syncQueue.add({ table: "rooms", op: "update", payload, match: { room_no: roomNo }, created_at: Date.now() });
    return { queued: true as const };
  }
  const { error } = await supabase.from("rooms").update(payload).eq("room_no", roomNo);
  if (error) {
    await getDb().syncQueue.add({ table: "rooms", op: "update", payload, match: { room_no: roomNo }, created_at: Date.now() });
    return { queued: true as const };
  }
  return { queued: false as const };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function usePendingCount() {
  return useLiveQuery(() => getDb().syncQueue.count(), [], 0) ?? 0;
}
