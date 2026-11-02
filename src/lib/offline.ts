// All writes now go straight to this device's storage — nothing waits for internet.
import { local, type DataTable } from "@/lib/localdb";

export async function insertStayOfflineFirst(row: Record<string, unknown>) {
  const { data } = await local.from("stays").insert(row);
  return { queued: false as const, id: data?.[0]?.id };
}

export async function updateRoomOfflineFirst(roomNo: string, status: string) {
  await local.from("rooms").update({ status }).eq("room_no", roomNo);
  return { queued: false as const };
}

export async function writeOfflineFirst(item: { table: DataTable; op: "insert" | "update"; payload: unknown; match?: Record<string, unknown> }) {
  const t = local.from(item.table);
  if (item.op === "insert") await t.insert(item.payload);
  else await t.update(item.payload).match(item.match ?? {});
  return { queued: false as const };
}
