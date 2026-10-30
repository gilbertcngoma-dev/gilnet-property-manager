import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { insertStayOfflineFirst, updateRoomOfflineFirst } from "@/lib/offline";
import { PAYMENT_METHODS, calcStay, kwacha, roomsQuery, staysQuery, todayISO, type Stay } from "@/lib/lodge";

const frontDeskSearchSchema = z.object({
  guest: fallback(z.string(), "").default(""),
  room: fallback(z.string(), "").default(""),
  in: fallback(z.string(), "").default(""),
  out: fallback(z.string(), "").default(""),
  rate: fallback(z.number(), 0).default(0),
});

export const Route = createFileRoute("/_authenticated/front-desk")({
  validateSearch: zodValidator(frontDeskSearchSchema),
  head: () => ({
    meta: [
      { title: "Front Desk — Lodge Manager" },
      { name: "description", content: "Check in guests and track current stays." },
      { property: "og:title", content: "Front Desk — Lodge Manager" },
      { property: "og:description", content: "Check in guests and track current stays." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FrontDesk,
});

const tomorrow = () => new Date(Date.parse(todayISO()) + 86400000).toISOString().slice(0, 10);

type Panel = { kind: "edit" | "laundry" | "service"; stay: Stay } | null;

function FrontDesk() {
  const qc = useQueryClient();
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const search = Route.useSearch();
  const blank = { guest_name: "", phone: "", guest_requests: "", check_in: todayISO(), check_out: tomorrow(), room_no: "", rate_per_night: 0, laundry_cost: 0, amount_paid: 0, payment_method: "Cash" as Stay["payment_method"] };
  const [f, setF] = useState(() => ({
    ...blank,
    guest_name: search.guest || "",
    room_no: search.room || "",
    check_in: search.in || todayISO(),
    check_out: search.out || tomorrow(),
    rate_per_night: search.rate || 0,
  }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const c = calcStay(f);
  const set = (k: keyof typeof f, v: string | number) => setF({ ...f, [k]: v });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["rooms"] }), qc.invalidateQueries({ queryKey: ["stays"] }), qc.invalidateQueries({ queryKey: ["restaurant_sales"] })]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.guest_name || !f.room_no || c.nights < 1) { setMsg("Fill guest, room and valid dates."); return; }
    setSaving(true); setMsg("");
    const result = await insertStayOfflineFirst({ ...f, phone: f.phone || null, guest_requests: f.guest_requests || null, amount_paid: f.payment_method === "Pending" ? 0 : f.amount_paid, status: "Checked-in" });
    await updateRoomOfflineFirst(f.room_no, "Occupied");
    setSaving(false);
    setF(blank);
    setMsg(result.queued ? "Saved offline — will sync when online." : "Guest checked in.");
    refresh();
  }

  async function checkout(s: Stay) {
    await supabase.from("rooms").update({ status: "Cleaning" }).eq("room_no", s.room_no);
    if (s.check_out > todayISO()) await supabase.from("stays").update({ check_out: todayISO() }).eq("id", s.id);
    refresh();
  }

  async function updatePaid(s: Stay, amount: number) {
    await supabase.from("stays").update({ amount_paid: amount }).eq("id", s.id);
    refresh();
  }

  const occupiedRooms = new Set(rooms.filter((r) => r.status === "Occupied").map((r) => r.room_no));
  const current = stays.filter((s) => occupiedRooms.has(s.room_no) && s.check_in <= todayISO());
  const latestPerRoom = Object.values(Object.fromEntries([...current].reverse().map((s) => [s.room_no, s])));

  const actions = (s: Stay) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost" onClick={() => setPanel({ kind: "edit", stay: s })}>Edit</button>
      <button type="button" className="btn-ghost" onClick={() => setPanel({ kind: "laundry", stay: s })}>Add laundry</button>
      <button type="button" className="btn-ghost" onClick={() => setPanel({ kind: "service", stay: s })}>Room service</button>
      <button type="button" className="btn-ghost" onClick={() => checkout(s)}>Check out</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Front Desk</h1>
      <form onSubmit={submit} className="card grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2"><label className="label">Guest name</label><input className="field" value={f.guest_name} onChange={(e) => set("guest_name", e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="field" placeholder="e.g. 0977 000 000" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className="label">Room</label>
          <select className="field" value={f.room_no} onChange={(e) => set("room_no", e.target.value)}>
            <option value="">Select vacant room</option>
            {rooms.filter((r) => r.status === "Vacant").map((r) => <option key={r.id} value={r.room_no}>{r.room_no} — {r.room_type}</option>)}
          </select>
        </div>
        <div><label className="label">Payment method</label>
            <select className="field" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value as Stay["payment_method"], amount_paid: e.target.value === "Pending" ? 0 : f.amount_paid })}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div><label className="label">Check-in</label><input type="date" className="field" value={f.check_in} onChange={(e) => set("check_in", e.target.value)} /></div>
        <div><label className="label">Check-out</label><input type="date" className="field" value={f.check_out} onChange={(e) => set("check_out", e.target.value)} /></div>
        <div><label className="label">Rate / night (K)</label><input type="number" min="0" className="field" value={f.rate_per_night} onChange={(e) => set("rate_per_night", Number(e.target.value))} /></div>
        <div><label className="label">Laundry (K)</label><input type="number" min="0" className="field" value={f.laundry_cost} onChange={(e) => set("laundry_cost", Number(e.target.value))} /></div>
        <div><label className="label">Amount paid (K)</label><input type="number" min="0" disabled={f.payment_method === "Pending"} className="field" value={f.amount_paid} onChange={(e) => set("amount_paid", Number(e.target.value))} /></div>
        <div className="md:col-span-4"><label className="label">Guest requests</label><input className="field" placeholder="e.g. extra towels, early breakfast" value={f.guest_requests} onChange={(e) => set("guest_requests", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-sm md:col-span-3 md:grid-cols-4">
          <div><div className="label">Nights</div><b>{c.nights}</b></div>
          <div><div className="label">Room revenue</div><b>{kwacha(c.room_revenue)}</b></div>
          <div><div className="label">Total</div><b>{kwacha(c.total_revenue)}</b></div>
          <div><div className="label">Balance</div><b className={c.balance > 0 ? "text-destructive" : "text-accent"}>{kwacha(c.balance)}</b></div>
        </div>
        <div className="flex flex-col gap-2 md:col-span-4 md:flex-row md:items-center">
          <button className="btn" disabled={saving}>{saving ? "Saving…" : "Check in guest"}</button>
          {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
        </div>
      </form>

      {panel?.kind === "edit" && <EditStay stay={panel.stay} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(); }} />}
      {panel?.kind === "laundry" && <AddLaundry stay={panel.stay} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(); }} />}
      {panel?.kind === "service" && <RoomService stay={panel.stay} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(); }} />}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Current guests</h2>
        {latestPerRoom.length === 0 ? <p className="text-sm text-muted-foreground">No guests in house.</p> : (
          <>
          <div className="space-y-3 md:hidden">
            {latestPerRoom.map((s) => { const k = calcStay(s); return (
              <div key={s.id} className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.guest_name}</span>
                  <span className="text-muted-foreground">Room {s.room_no}</span>
                </div>
                <div className="text-xs text-muted-foreground">{s.check_in} → {s.check_out} · {k.nights} night{k.nights === 1 ? "" : "s"}</div>
                {s.phone && <div className="text-xs">📞 {s.phone}</div>}
                {s.guest_requests && <div className="text-xs text-muted-foreground">Requests: {s.guest_requests}</div>}
                <div className="grid grid-cols-3 gap-2">
                  <div><div className="label">Total</div><b>{kwacha(k.total_revenue)}</b></div>
                  <div><div className="label">Paid (K)</div><input type="number" className="field w-full py-1" defaultValue={s.amount_paid} onBlur={(e) => Number(e.target.value) !== Number(s.amount_paid) && updatePaid(s, Number(e.target.value))} /></div>
                  <div><div className="label">Balance</div><b className={k.balance > 0 ? "text-destructive" : ""}>{kwacha(k.balance)}</b></div>
                </div>
                {actions(s)}
              </div>); })}
          </div>
          <table className="hidden w-full text-sm md:table">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2">Guest</th><th>Room</th><th>Dates</th><th>Nights</th><th>Total</th><th>Paid</th><th>Balance</th><th></th></tr></thead>
            <tbody className="divide-y">
              {latestPerRoom.map((s) => { const k = calcStay(s); return (
                <tr key={s.id}>
                  <td className="py-2 font-medium">{s.guest_name}{s.phone && <div className="text-xs font-normal text-muted-foreground">{s.phone}</div>}{s.guest_requests && <div className="text-xs font-normal text-muted-foreground">Requests: {s.guest_requests}</div>}</td><td>{s.room_no}</td>
                  <td>{s.check_in} → {s.check_out}</td><td>{k.nights}</td><td>{kwacha(k.total_revenue)}</td>
                  <td><input type="number" className="field w-24 py-1" defaultValue={s.amount_paid} onBlur={(e) => Number(e.target.value) !== Number(s.amount_paid) && updatePaid(s, Number(e.target.value))} /></td>
                  <td className={k.balance > 0 ? "font-semibold text-destructive" : ""}>{kwacha(k.balance)}</td>
                  <td>{actions(s)}</td>
                </tr>); })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}

function EditStay({ stay, onClose, onSaved }: { stay: Stay; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ guest_name: stay.guest_name, phone: stay.phone ?? "", guest_requests: stay.guest_requests ?? "", check_in: stay.check_in, check_out: stay.check_out, rate_per_night: stay.rate_per_night, laundry_cost: stay.laundry_cost, payment_method: stay.payment_method });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const c = calcStay({ ...f, amount_paid: stay.amount_paid });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.guest_name || c.nights < 1) { setMsg("Fill guest name and valid dates."); return; }
    setSaving(true);
    const { error } = await supabase.from("stays").update({ ...f, phone: f.phone || null, guest_requests: f.guest_requests || null }).eq("id", stay.id);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    onSaved();
  }

  return (
    <form onSubmit={save} className="card grid gap-4 md:grid-cols-4">
      <h2 className="text-lg font-semibold md:col-span-4">Edit stay — {stay.guest_name} (Room {stay.room_no})</h2>
      <div className="md:col-span-2"><label className="label">Guest name</label><input className="field" value={f.guest_name} onChange={(e) => setF({ ...f, guest_name: e.target.value })} /></div>
      <div><label className="label">Phone</label><input className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div><label className="label">Guest requests</label><input className="field" value={f.guest_requests} onChange={(e) => setF({ ...f, guest_requests: e.target.value })} /></div>
      <div><label className="label">Check-in</label><input type="date" className="field" value={f.check_in} onChange={(e) => setF({ ...f, check_in: e.target.value })} /></div>
      <div><label className="label">Check-out</label><input type="date" className="field" value={f.check_out} onChange={(e) => setF({ ...f, check_out: e.target.value })} /></div>
      <div><label className="label">Rate / night (K)</label><input type="number" min="0" className="field" value={f.rate_per_night} onChange={(e) => setF({ ...f, rate_per_night: Number(e.target.value) })} /></div>
      <div><label className="label">Laundry (K)</label><input type="number" min="0" className="field" value={f.laundry_cost} onChange={(e) => setF({ ...f, laundry_cost: Number(e.target.value) })} /></div>
      <div><label className="label">Payment method</label>
        <select className="field" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value as Stay["payment_method"] })}>
          {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-sm md:col-span-4 md:grid-cols-4">
        <div><div className="label">Nights</div><b>{c.nights}</b></div>
        <div><div className="label">Room revenue</div><b>{kwacha(c.room_revenue)}</b></div>
        <div><div className="label">Total</div><b>{kwacha(c.total_revenue)}</b></div>
        <div><div className="label">Balance</div><b className={c.balance > 0 ? "text-destructive" : "text-accent"}>{kwacha(c.balance)}</b></div>
      </div>
      <div className="flex items-center gap-3 md:col-span-4">
        <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </form>
  );
}

function AddLaundry({ stay, onClose, onSaved }: { stay: Stay; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (amount <= 0) { setMsg("Enter an amount above 0."); return; }
    setSaving(true);
    const { error } = await supabase.from("stays").update({ laundry_cost: Number(stay.laundry_cost) + amount }).eq("id", stay.id);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    onSaved();
  }

  return (
    <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
      <h2 className="w-full text-lg font-semibold">Add laundry — {stay.guest_name} (Room {stay.room_no})</h2>
      <div><label className="label">Laundry charge (K)</label><input type="number" min="0" step="0.01" className="field w-32" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
      <div className="text-sm text-muted-foreground">Current laundry: {kwacha(Number(stay.laundry_cost))} → New: {kwacha(Number(stay.laundry_cost) + amount)}</div>
      <button className="btn" disabled={saving}>{saving ? "Saving…" : "Add charge"}</button>
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </form>
  );
}

function RoomService({ stay, onClose, onSaved }: { stay: Stay; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ item: "", quantity: 1, unit_price: 0 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const total = f.quantity * f.unit_price;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.item || total <= 0) { setMsg("Enter an item and a price above 0."); return; }
    setSaving(true);
    const { error } = await supabase.from("restaurant_sales").insert({ sale_date: todayISO(), item: f.item, quantity: f.quantity, unit_price: f.unit_price, room_no: stay.room_no, payment_method: "Pending", service_type: "Room service" });
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    onSaved();
  }

  return (
    <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
      <h2 className="w-full text-lg font-semibold">Room service — {stay.guest_name} (Room {stay.room_no})</h2>
      <div><label className="label">Item</label><input className="field" placeholder="e.g. Nshima & chicken" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></div>
      <div><label className="label">Qty</label><input type="number" min={1} className="field w-20" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
      <div><label className="label">Price (K)</label><input type="number" min={0} step="0.01" className="field w-28" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: Number(e.target.value) })} /></div>
      <div className="text-sm font-semibold">Total: {kwacha(total)}</div>
      <button className="btn" disabled={saving}>{saving ? "Saving…" : "Add to room"}</button>
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      <p className="w-full text-xs text-muted-foreground">Added as a Pending room-service sale for Room {stay.room_no} — collect payment at check-out.</p>
    </form>
  );
}
