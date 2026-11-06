// Owner overview: each computer pushes a small "how is my lodge doing today"
// summary to the cloud; the Owner page reads the summaries for every lodge.
import { db } from "@/lib/localdb";
import { getProperty } from "@/lib/property";
import { todayISO } from "@/lib/lodge";

export type CentralStatus = {
  property_code: string;
  property_name: string;
  date: string;
  total_guests_today: number;
  total_sales_today: number;
  cash_collected_today: number;
  rooms_occupied: number;
  rooms_available: number;
  last_checkin_name: string | null;
  last_checkin_time: string | null;
  last_sync_at: string;
  is_online: boolean;
};

async function cloud() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

/** Push this lodge's today-summary to the cloud. Silent no-op when offline or signed out. */
export async function pushCentralStatus(): Promise<boolean> {
  if (!navigator.onLine) return false;
  const prop = await getProperty();
  if (!prop?.code) return false;
  const sb = await cloud();
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) return false;
  const d = db();
  const today = todayISO();
  const [rooms, stays, sales] = await Promise.all([d.rooms.toArray(), d.stays.toArray(), d.restaurant_sales.toArray()]);
  const todaysStays = stays.filter((s) => s["check_in"] === today);
  const todaysSales = sales.filter((s) => s["sale_date"] === today);
  const saleTotal = (s: Record<string, unknown>) => Number(s["quantity"] || 0) * Number(s["unit_price"] || 0);
  const lastCheckin = [...todaysStays].sort((a, b) => String(b["created_at"] ?? "").localeCompare(String(a["created_at"] ?? "")))[0];
  const { error } = await sb.from("central_sync").upsert({
    property_code: prop.code,
    property_name: prop.name,
    date: today,
    total_guests_today: todaysStays.length,
    total_sales_today: todaysSales.reduce((a, s) => a + saleTotal(s), 0),
    cash_collected_today:
      todaysStays.filter((s) => s["payment_method"] === "Cash").reduce((a, s) => a + Number(s["amount_paid"] || 0), 0) +
      todaysSales.filter((s) => s["payment_method"] === "Cash").reduce((a, s) => a + saleTotal(s), 0),
    rooms_occupied: rooms.filter((r) => r["status"] === "Occupied").length,
    rooms_available: rooms.filter((r) => r["status"] === "Vacant").length,
    last_checkin_name: (lastCheckin?.["guest_name"] as string | undefined) ?? null,
    last_checkin_time: (lastCheckin?.["created_at"] as string | undefined) ?? null,
    last_sync_at: new Date().toISOString(),
    is_online: true,
  }, { onConflict: "property_code" });
  return !error;
}

/** Read every lodge's latest summary. Throws when offline or signed out. */
export async function fetchCentralStatuses(): Promise<CentralStatus[]> {
  if (!navigator.onLine) throw new Error("No internet right now.");
  const sb = await cloud();
  const { data: sess } = await sb.auth.getSession();
  if (!sess.session) throw new Error("Sign in to the cloud account first (Cloud sync page).");
  const { data, error } = await sb.from("central_sync").select("*").order("property_code");
  if (error) throw error;
  return (data ?? []) as CentralStatus[];
}

/** green < 2h, yellow 2–12h, red > 12h since the lodge last reported. */
export function syncHealth(lastSyncAt: string): "green" | "yellow" | "red" {
  const ageMs = Date.now() - Date.parse(lastSyncAt);
  if (!Number.isFinite(ageMs)) return "red";
  if (ageMs < 2 * 3600_000) return "green";
  if (ageMs < 12 * 3600_000) return "yellow";
  return "red";
}
