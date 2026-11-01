import { writeOfflineFirst } from "@/lib/offline";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MENU_ITEMS, PAYMENT_METHODS, ROOM_NUMBERS, ROOM_SERVICE_CHARGE_ITEM, kwacha, todayISO } from "@/lib/lodge";
import { Button } from "@/components/ui/button";

export const restaurantQuery = queryOptions({
  queryKey: ["restaurant_sales"],
  queryFn: async () => {
    const { data, error } = await supabase.from("restaurant_sales").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

type Sale = {
  id: string;
  sale_date: string;
  item: string;
  quantity: number;
  unit_price: number;
  room_no: string | null;
  payment_method: string;
  service_type: string;
};

export const Route = createFileRoute("/_authenticated/restaurant")({
  head: () => ({
    meta: [
      { title: "Restaurant — Lodge Manager" },
      { name: "description", content: "Record restaurant and bar sales." },
      { property: "og:title", content: "Restaurant — Lodge Manager" },
      { property: "og:description", content: "Record restaurant and bar sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Restaurant,
});

function Restaurant() {
  const qc = useQueryClient();
  const sales = useQuery(restaurantQuery).data ?? [];
  const blank = { sale_date: todayISO(), item: "", quantity: 1, unit_price: 0, room_no: "", payment_method: "Cash", service_type: "Restaurant" };
  const [f, setF] = useState(blank);
  const [charge, setCharge] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const today = todayISO();
  const month = today.slice(0, 7);
  const total = (s: { quantity: number; unit_price: number }) => Number(s.quantity) * Number(s.unit_price);
  const todayTotal = sales.filter((s) => s.sale_date === today).reduce((a, s) => a + total(s), 0);
  const monthTotal = sales.filter((s) => s.sale_date.startsWith(month)).reduce((a, s) => a + total(s), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.item || (f.service_type === "Room service" && !f.room_no.trim())) { setMessage("Enter an item and a room number for room service."); return; }
    setSaving(true);
    const rows = [{ ...f, room_no: f.room_no.trim() || null }];
    if (f.service_type === "Room service" && charge > 0) rows.push({ ...f, item: ROOM_SERVICE_CHARGE_ITEM, quantity: 1, unit_price: charge, room_no: f.room_no.trim() });
    const rowsWithId = rows.map((r) => ({ ...r, id: crypto.randomUUID() }));
    const { queued } = await writeOfflineFirst({ table: "restaurant_sales", op: "insert", payload: rowsWithId as never });
    setSaving(false);
    setMessage(queued ? "No internet — sale saved and will sync when online." : "Sale added.");
    setF({ ...blank, sale_date: f.sale_date });
    setCharge(0);
    qc.invalidateQueries({ queryKey: ["restaurant_sales"] });
  }
  async function remove(id: string) {
    await supabase.from("restaurant_sales").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["restaurant_sales"] });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Restaurant</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card"><div className="text-sm text-muted-foreground">Sales today</div><div className="text-2xl font-bold">{kwacha(todayTotal)}</div></div>
        <div className="card"><div className="text-sm text-muted-foreground">Sales this month</div><div className="text-2xl font-bold">{kwacha(monthTotal)}</div></div>
      </div>
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="service-type">Service</label><select id="service-type" className="field" value={f.service_type} onChange={(e) => setF({ ...f, service_type: e.target.value })}><option>Restaurant</option><option>Room service</option></select></div>
        <div><label className="label">Date</label><input type="date" className="field" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></div>
        <div><label className="label">Item</label><ItemSelect value={f.item} onChange={(item) => setF({ ...f, item })} /></div>
        <div><label className="label">Qty</label><input type="number" min={1} className="field w-20" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
        <div><label className="label">Price (K)</label><input type="number" min={0} step="0.01" className="field w-28" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: Number(e.target.value) })} /></div>
        <div><label className="label" htmlFor="sale-room">{f.service_type === "Room service" ? "Room number" : "Room / Walk-in"}</label><RoomSelect id="sale-room" walkIn={f.service_type !== "Room service"} value={f.room_no} onChange={(room_no) => setF({ ...f, room_no })} /></div>
        {f.service_type === "Room service" && <div><label className="label" htmlFor="rs-charge">Room service charge (K)</label><input id="rs-charge" type="number" min={0} step="0.01" className="field w-28" value={charge} onChange={(e) => setCharge(Number(e.target.value))} /></div>}
        <div><label className="label">Payment</label><select className="field" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="text-sm font-semibold">Total: {kwacha(total(f) + (f.service_type === "Room service" ? charge : 0))}</div>
        <Button disabled={saving}>{saving ? "Saving…" : "Add sale"}</Button>
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </form>
      {editing && <EditSale sale={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["restaurant_sales"] }); }} />}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Item</th><th className="p-2">Service</th><th className="p-2">Qty</th><th className="p-2">Room</th><th className="p-2">Payment</th><th className="p-2 text-right">Total</th><th /></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">{s.sale_date}</td><td className="p-2">{s.item}</td><td className="p-2">{s.service_type}</td><td className="p-2">{s.quantity}</td>
                <td className="p-2">{s.room_no ?? "Walk-in"}</td><td className="p-2">{s.payment_method}</td>
                <td className="p-2 text-right font-semibold">{kwacha(total(s))}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button type="button" className="mr-3 text-xs text-primary" onClick={() => setEditing(s as Sale)}>Edit</button>
                  <button type="button" className="text-xs text-destructive" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditSale({ sale, onClose, onSaved }: { sale: Sale; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ sale_date: sale.sale_date, item: sale.item, quantity: sale.quantity, unit_price: sale.unit_price, room_no: sale.room_no ?? "", payment_method: sale.payment_method, service_type: sale.service_type });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const total = f.quantity * f.unit_price;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.item || (f.service_type === "Room service" && !f.room_no.trim())) { setMsg("Enter an item and a room number for room service."); return; }
    setSaving(true);
    const { error } = await supabase.from("restaurant_sales").update({ ...f, room_no: f.room_no.trim() || null }).eq("id", sale.id);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    onSaved();
  }

  return (
    <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
      <h2 className="w-full text-lg font-semibold">Edit sale — {sale.item}</h2>
      <div><label className="label">Service</label><select className="field" value={f.service_type} onChange={(e) => setF({ ...f, service_type: e.target.value })}><option>Restaurant</option><option>Room service</option></select></div>
      <div><label className="label">Date</label><input type="date" className="field" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></div>
      <div><label className="label">Item</label><ItemSelect value={f.item} onChange={(item) => setF({ ...f, item })} /></div>
      <div><label className="label">Qty</label><input type="number" min={1} className="field w-20" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
      <div><label className="label">Price (K)</label><input type="number" min={0} step="0.01" className="field w-28" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: Number(e.target.value) })} /></div>
      <div><label className="label">{f.service_type === "Room service" ? "Room number" : "Room / Walk-in"}</label><RoomSelect walkIn={f.service_type !== "Room service"} value={f.room_no} onChange={(room_no) => setF({ ...f, room_no })} /></div>
      <div><label className="label">Payment</label><select className="field" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
      <div className="text-sm font-semibold">Total: {kwacha(total)}</div>
      <Button disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </form>
  );
}

function ItemSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const known = (MENU_ITEMS as readonly string[]).includes(value) || value === ROOM_SERVICE_CHARGE_ITEM;
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose item…</option>
      {MENU_ITEMS.map((m) => <option key={m}>{m}</option>)}
      <option>{ROOM_SERVICE_CHARGE_ITEM}</option>
      {value && !known && <option>{value}</option>}
    </select>
  );
}

function RoomSelect({ id, value, onChange, walkIn }: { id?: string; value: string; onChange: (v: string) => void; walkIn: boolean }) {
  return (
    <select id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{walkIn ? "Walk-in" : "Choose room…"}</option>
      {ROOM_NUMBERS.map((r) => <option key={r} value={r}>Room {r}</option>)}
      {value && !ROOM_NUMBERS.includes(value) && <option value={value}>Room {value}</option>}
    </select>
  );
}
