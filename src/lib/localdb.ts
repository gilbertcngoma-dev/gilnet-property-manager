// Offline-first storage: every lodge record lives on this device (IndexedDB via Dexie).
// `local.from(table)` mirrors the small slice of the old online client API the pages use.
import Dexie, { type Table } from "dexie";

export type Row = Record<string, unknown> & { id: string };
export const DATA_TABLES = ["rooms", "stays", "restaurant_sales"] as const;
export type DataTable = (typeof DATA_TABLES)[number];

class LocalDB extends Dexie {
  rooms!: Table<Row, string>;
  stays!: Table<Row, string>;
  restaurant_sales!: Table<Row, string>;
  settings!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super("gilnet-property-manager");
    this.version(1).stores({ rooms: "id, room_no", stays: "id, room_no, check_in", restaurant_sales: "id, sale_date", settings: "key" });
  }
}

let _db: LocalDB | null = null;
export function db() {
  if (typeof window === "undefined") throw new Error("Local storage is only available in the browser.");
  if (!_db) _db = new LocalDB();
  return _db;
}

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const DEFAULTS: Record<DataTable, () => Record<string, unknown>> = {
  rooms: () => ({ room_type: "Standard", status: "Vacant", floor: 1 }),
  stays: () => ({ rate_per_night: 0, laundry_cost: 0, amount_paid: 0, payment_method: "Cash", phone: null, guest_requests: null, status: "Confirmed", receipt_no: null }),
  restaurant_sales: () => ({ sale_date: today(), quantity: 1, unit_price: 0, room_no: null, payment_method: "Cash", service_type: "Restaurant", receipt_no: null }),
};

/** Rooms 01–15 (04–06 Twin) are created the first time the app opens on a device. */
export async function seedRooms() {
  const d = db();
  if ((await d.rooms.count()) > 0) return;
  const now = new Date().toISOString();
  await d.rooms.bulkPut(Array.from({ length: 15 }, (_, i) => {
    const room_no = String(i + 1).padStart(2, "0");
    return { id: crypto.randomUUID(), room_no, room_type: ["04", "05", "06"].includes(room_no) ? "Twin" : "Standard", status: "Vacant", floor: 1, created_at: now };
  }));
}

type Result = { data: Row[] | null; error: { message: string } | null };

class Query implements PromiseLike<Result> {
  private filters: [string, unknown][] = [];
  private orderCol?: string;
  private asc = true;
  constructor(private table: DataTable, private op: "select" | "insert" | "update" | "delete", private payload?: unknown) {}
  select(_cols?: string) { return this; }
  eq(k: string, v: unknown) { this.filters.push([k, v]); return this; }
  match(o: Record<string, unknown>) { Object.entries(o).forEach(([k, v]) => this.filters.push([k, v])); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.asc = opts?.ascending ?? true; return this; }
  private matches(r: Row) { return this.filters.every(([k, v]) => r[k] === v); }
  async run(): Promise<Result> {
    try {
      const t = db()[this.table];
      if (this.op === "insert") {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Record<string, unknown>[];
        const rows = list.map((p) => ({ ...DEFAULTS[this.table](), created_at: new Date().toISOString(), ...p, id: (p["id"] as string) || crypto.randomUUID() })) as Row[];
        await t.bulkPut(rows);
        return { data: rows, error: null };
      }
      const all = (await t.toArray()).filter((r) => this.matches(r));
      if (this.op === "update") {
        const rows = all.map((r) => ({ ...r, ...(this.payload as object), id: r.id }));
        await t.bulkPut(rows);
        return { data: rows, error: null };
      }
      if (this.op === "delete") {
        await t.bulkDelete(all.map((r) => r.id));
        return { data: all, error: null };
      }
      if (this.orderCol) {
        const c = this.orderCol;
        all.sort((a, b) => String(a[c] ?? "").localeCompare(String(b[c] ?? "")) * (this.asc ? 1 : -1));
      }
      return { data: all, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Could not save on this computer." } };
    }
  }
  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.run().then(ok, bad);
  }
}

export const local = {
  from: (table: DataTable) => ({
    select: (_c?: string) => new Query(table, "select"),
    insert: (p: unknown) => new Query(table, "insert", p),
    update: (p: unknown) => new Query(table, "update", p),
    delete: () => new Query(table, "delete"),
  }),
};

export type Backup = { app: "gilnet-property-manager"; version: 1; exported_at: string } & Record<DataTable, Row[]>;

export async function exportBackup(): Promise<Backup> {
  const d = db();
  const [rooms, stays, restaurant_sales] = await Promise.all([d.rooms.toArray(), d.stays.toArray(), d.restaurant_sales.toArray()]);
  return { app: "gilnet-property-manager", version: 1, exported_at: new Date().toISOString(), rooms, stays, restaurant_sales };
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup;
  return !!b && b.app === "gilnet-property-manager" && DATA_TABLES.every((t) => Array.isArray(b[t]) && b[t].every((r) => typeof r?.id === "string"));
}

/** Merge a backup into this device: records with the same id are replaced, others are added. */
export async function importBackup(b: Backup) {
  const d = db();
  await d.transaction("rw", d.rooms, d.stays, d.restaurant_sales, async () => {
    // Rooms are matched by room number so two devices' rooms don't duplicate.
    const existing = await d.rooms.toArray();
    const byNo = new Map(existing.map((r) => [r["room_no"], r.id]));
    await d.rooms.bulkPut(b.rooms.map((r) => ({ ...r, id: byNo.get(r["room_no"]) ?? r.id })));
    await d.stays.bulkPut(b.stays);
    await d.restaurant_sales.bulkPut(b.restaurant_sales);
  });
  return { rooms: b.rooms.length, stays: b.stays.length, sales: b.restaurant_sales.length };
}
