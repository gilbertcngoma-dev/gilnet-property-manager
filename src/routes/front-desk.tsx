import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_METHODS, calcStay, kwacha, roomsQuery, staysQuery, todayISO, type Stay } from "@/lib/lodge";

export const Route = createFileRoute("/front-desk")({
  head: () => ({
    meta: [
      { title: "Front Desk — Lodge Manager" },
      { name: "description", content: "Check in guests and track current stays." },
      { property: "og:title", content: "Front Desk — Lodge Manager" },
      { property: "og:description", content: "Check in guests and track current stays." },
    ],
  }),
  component: FrontDesk,
});

const tomorrow = () => new Date(Date.parse(todayISO()) + 86400000).toISOString().slice(0, 10);

function FrontDesk() {
  const qc = useQueryClient();
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const blank = { guest_name: "", check_in: todayISO(), check_out: tomorrow(), room_no: "", rate_per_night: 0, laundry_cost: 0, amount_paid: 0, payment_method: "Cash" as Stay["payment_method"] };
  const [f, setF] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const c = calcStay(f);
  const set = (k: keyof typeof f, v: string | number) => setF({ ...f, [k]: v });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["rooms"] }), qc.invalidateQueries({ queryKey: ["stays"] })]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.guest_name || !f.room_no || c.nights < 1) { setMsg("Fill guest, room and valid dates."); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("stays").insert({ ...f, amount_paid: f.payment_method === "Pending" ? 0 : f.amount_paid });
    if (!error) await supabase.from("rooms").update({ status: "Occupied" }).eq("room_no", f.room_no);
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    setF(blank); setMsg("Guest checked in."); refresh();
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Front Desk</h1>
      <form onSubmit={submit} className="card grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2"><label className="label">Guest name</label><input className="field" value={f.guest_name} onChange={(e) => set("guest_name", e.target.value)} /></div>
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

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-lg font-semibold">Current guests</h2>
        {latestPerRoom.length === 0 ? <p className="text-sm text-muted-foreground">No guests in house.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-2">Guest</th><th>Room</th><th>Dates</th><th>Nights</th><th>Total</th><th>Paid</th><th>Balance</th><th></th></tr></thead>
            <tbody className="divide-y">
              {latestPerRoom.map((s) => { const k = calcStay(s); return (
                <tr key={s.id}>
                  <td className="py-2 font-medium">{s.guest_name}</td><td>{s.room_no}</td>
                  <td>{s.check_in} → {s.check_out}</td><td>{k.nights}</td><td>{kwacha(k.total_revenue)}</td>
                  <td><input type="number" className="field w-24 py-1" defaultValue={s.amount_paid} onBlur={(e) => Number(e.target.value) !== Number(s.amount_paid) && updatePaid(s, Number(e.target.value))} /></td>
                  <td className={k.balance > 0 ? "font-semibold text-destructive" : ""}>{kwacha(k.balance)}</td>
                  <td><button type="button" className="btn-ghost" onClick={() => checkout(s)}>Check out</button></td>
                </tr>); })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
