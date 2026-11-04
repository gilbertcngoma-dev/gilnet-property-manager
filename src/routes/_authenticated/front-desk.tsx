import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { local } from "@/lib/localdb";
import { insertStayOfflineFirst, updateRoomOfflineFirst } from "@/lib/offline";
import { getProperty, receiptTaken, suggestReceiptNo } from "@/lib/property";
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

type Panel = { kind: "edit" | "laundry" | "service" | "pay"; stay: Stay } | null;
type Rec = { id: string; receipt_no?: string | null };

function useReceipts() {
  const code = useQuery({ queryKey: ["property"], queryFn: async () => (await getProperty())?.code ?? "" }).data ?? "";
  const sales = useQuery({ queryKey: ["restaurant_sales"], queryFn: async () => ((await local.from("restaurant_sales").select("*")).data ?? []) as Rec[] }).data ?? [];
  return { code, sales };
}

function FrontDesk() {
  const qc = useQueryClient();
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const search = Route.useSearch();
  const { code, sales } = useReceipts();
  const blank = { receipt_no: "", guest_name: "", phone: "", guest_requests: "", check_in: todayISO(), check_out: tomorrow(), room_no: "", rate_per_night: 0, laundry_cost: 0, amount_paid: 0, payment_method: "Cash" as Stay["payment_method"] };
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
    const paid = f.payment_method !== "Pending" && f.amount_paid > 0;
    const receipt = f.receipt_no.trim().toUpperCase();
    if (paid && !receipt) { setMsg("Enter the receipt number from the receipt book."); return; }
    if (receipt && receiptTaken(receipt, undefined, stays, sales)) { setMsg(`Receipt ${receipt} already used`); return; }
    setSaving(true); setMsg("");
    const result = await insertStayOfflineFirst({ ...f, receipt_no: receipt || null, phone: f.phone || null, guest_requests: f.guest_requests || null, amount_paid: f.payment_method === "Pending" ? 0 : f.amount_paid, status: "Checked-in" });
    await updateRoomOfflineFirst(f.room_no, "Occupied");
    setSaving(false);
    setF(blank);
    void result; setMsg(paid ? "Guest checked in. Saved locally." : "Guest checked in as Unpaid. Saved locally.");
    refresh();
  }

  async function checkout(s: Stay) {
    await local.from("rooms").update({ status: "Cleaning" }).eq("room_no", s.room_no);
    await local.from("stays").update(s.check_out > todayISO() ? { check_out: todayISO(), status: "Checked-out" } : { status: "Checked-out" }).eq("id", s.id);
    refresh();
  }

  async function updatePaid(s: Stay, amount: number) {
    await local.from("stays").update({ amount_paid: amount }).eq("id", s.id);
    refresh();
  }

  const occupiedRooms = new Set(rooms.filter((r) => r.status === "Occupied").map((r) => r.room_no));
  const current = stays.filter((s) => occupiedRooms.has(s.room_no) && s.check_in <= todayISO());
  const latestPerRoom = Object.values(Object.fromEntries([...current].reverse().map((s) => [s.room_no, s])));

  const actions = (s: Stay) => (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-ghost" onClick={() => setPanel({ kind: "edit", stay: s })}>Edit</button>
      {!s.receipt_no && <button type="button" className="btn-ghost" onClick={() => setPanel({ kind: "pay", stay: s })}>Add Payment / Receipt</button>}
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
        <div><label className="label">Receipt number {f.payment_method !== "Pending" && f.amount_paid > 0 ? "(required)" : "(optional if unpaid)"}</label>
          <input className="field" placeholder={`${code || "CODE"}-0001`} value={f.receipt_no} onChange={(e) => set("receipt_no", e.target.value)} /></div>
        <div className="flex items-end"><button type="button" className="btn-ghost" onClick={() => set("receipt_no", suggestReceiptNo(code, stays, sales))}>Suggest Next Number</button></div>
        <div className="md:col-span-2"><label className="label">Guest requests</label><input className="field" placeholder="e.g. extra towels, early breakfast" value={f.guest_requests} onChange={(e) => set("guest_requests", e.target.value)} /></div>
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
      {panel?.kind === "pay" && <AddPayment stay={panel.stay} code={code} stays={stays} sales={sales} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); refresh(); }} />}
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
                  <span className="font-medium">{s.guest_name} <PaidTag s={s} /></span>
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
                  <td className="py-2 font-medium">{s.guest_name} <PaidTag s={s} />{s.receipt_no && <div className="text-xs font-normal text-muted-foreground">Receipt {s.receipt_no}</div>}{s.phone && <div className="text-xs font-normal text-muted-foreground">{s.phone}</div>}{s.guest_requests && <div className="text-xs font-normal text-muted-foreground">Requests: {s.guest_requests}</div>}</td><td>{s.room_no}</td>
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
  const [f, setF] = useState({ guest_name: stay.guest_name, phone: stay.phone ?? "", guest_requests: stay.guest_requests ?? "", check_in: stay.check_in, check_out: stay.check_out, rate_per_night: stay.rate_per_night, laundry_cost: stay.laundry_cost, payment_method: stay.payment_method, status: stay.status });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const c = calcStay({ ...f, amount_paid: stay.amount_paid });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.guest_name || c.nights < 1) { setMsg("Fill guest name and valid dates."); return; }
    setSaving(true);
    const { error } = await local.from("stays").update({ ...f, phone: f.phone || null, guest_requests: f.guest_requests || null }).eq("id", stay.id);
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
      <div><label className="label">Booking status</label>
        <select className="field" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Stay["status"] })}>
          {(["Confirmed", "Pending", "Checked-in", "Later Date", "Cancelled"] as const).map((m) => <option key={m}>{m}</option>)}
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
    const { error } = await local.from("stays").update({ laundry_cost: Number(stay.laundry_cost) + amount }).eq("id", stay.id);
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
    const { error } = await local.from("restaurant_sales").insert({ sale_date: todayISO(), item: f.item, quantity: f.quantity, unit_price: f.unit_price, room_no: stay.room_no, payment_method: "Pending", service_type: "Room service" });
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

function PaidTag({ s }: { s: Stay }) {
  const unpaid = !s.receipt_no || calcStay(s).balance > 0;
  return <span className={`ml-1 rounded px-1.5 py-0.5 text-xs font-semibold ${unpaid ? "bg-destructive text-destructive-foreground" : "bg-muted"}`}>{unpaid ? "Unpaid" : "Paid"}</span>;
}

function AddPayment({ stay, code, stays, sales, onClose, onSaved }: { stay: Stay; code: string; stays: Stay[]; sales: Rec[]; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(Math.max(0, calcStay(stay).balance));
  const [method, setMethod] = useState<Stay["payment_method"]>("Cash");
  const [receipt, setReceipt] = useState("");
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = receipt.trim().toUpperCase();
    if (!r) { setMsg("Enter the receipt number."); return; }
    if (receiptTaken(r, stay.id, stays, sales)) { setMsg(`Receipt ${r} already used`); return; }
    const { error } = await local.from("stays").update({ receipt_no: r, payment_method: method, amount_paid: Number(stay.amount_paid) + amount }).eq("id", stay.id);
    if (error) { setMsg(error.message); return; }
    onSaved();
  }
  return (
    <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
      <h2 className="w-full text-lg font-semibold">Add payment — {stay.guest_name} (Room {stay.room_no})</h2>
      <div><label className="label">Amount (K)</label><input type="number" min="0" className="field w-28" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></div>
      <div><label className="label">Method</label><select className="field" value={method} onChange={(e) => setMethod(e.target.value as Stay["payment_method"])}>{PAYMENT_METHODS.filter((m) => m !== "Pending").map((m) => <option key={m}>{m}</option>)}</select></div>
      <div><label className="label">Receipt number</label><input className="field" placeholder={`${code || "CODE"}-0001`} value={receipt} onChange={(e) => setReceipt(e.target.value)} /></div>
      <button type="button" className="btn-ghost" onClick={() => setReceipt(suggestReceiptNo(code, stays, sales))}>Suggest Next Number</button>
      <button className="btn">Save payment</button>
      <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
      {msg && <span role="alert" className="text-sm text-destructive">{msg}</span>}
    </form>
  );
}
