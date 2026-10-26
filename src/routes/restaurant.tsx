import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { kwacha, todayISO } from "@/lib/lodge";

export const restaurantQuery = queryOptions({
  queryKey: ["restaurant_sales"],
  queryFn: async () => {
    const { data, error } = await supabase.from("restaurant_sales").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/restaurant")({
  head: () => ({
    meta: [
      { title: "Restaurant — Lodge Manager" },
      { name: "description", content: "Record restaurant and bar sales." },
      { property: "og:title", content: "Restaurant — Lodge Manager" },
      { property: "og:description", content: "Record restaurant and bar sales." },
    ],
  }),
  component: Restaurant,
});

function Restaurant() {
  const qc = useQueryClient();
  const sales = useQuery(restaurantQuery).data ?? [];
  const blank = { sale_date: todayISO(), item: "", quantity: 1, unit_price: 0, room_no: "", payment_method: "Cash" };
  const [f, setF] = useState(blank);
  const today = todayISO();
  const month = today.slice(0, 7);
  const total = (s: { quantity: number; unit_price: number }) => Number(s.quantity) * Number(s.unit_price);
  const todayTotal = sales.filter((s) => s.sale_date === today).reduce((a, s) => a + total(s), 0);
  const monthTotal = sales.filter((s) => s.sale_date.startsWith(month)).reduce((a, s) => a + total(s), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.item) return;
    await supabase.from("restaurant_sales").insert({ ...f, room_no: f.room_no || null });
    setF({ ...blank, sale_date: f.sale_date });
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
        <div><label className="label">Date</label><input type="date" className="field" value={f.sale_date} onChange={(e) => setF({ ...f, sale_date: e.target.value })} /></div>
        <div><label className="label">Item</label><input className="field" placeholder="e.g. Nshima & chicken" value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></div>
        <div><label className="label">Qty</label><input type="number" min={1} className="field w-20" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
        <div><label className="label">Price (K)</label><input type="number" min={0} step="0.01" className="field w-28" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: Number(e.target.value) })} /></div>
        <div><label className="label">Room (optional)</label><input className="field w-24" value={f.room_no} onChange={(e) => setF({ ...f, room_no: e.target.value })} /></div>
        <div><label className="label">Payment</label><select className="field" value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="text-sm font-semibold">Total: {kwacha(total(f))}</div>
        <button className="btn">Add sale</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Date</th><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Room</th><th className="p-2">Payment</th><th className="p-2 text-right">Total</th><th /></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">{s.sale_date}</td><td className="p-2">{s.item}</td><td className="p-2">{s.quantity}</td>
                <td className="p-2">{s.room_no ?? "-"}</td><td className="p-2">{s.payment_method}</td>
                <td className="p-2 text-right font-semibold">{kwacha(total(s))}</td>
                <td className="p-2 text-right"><button type="button" className="text-xs text-destructive" onClick={() => remove(s.id)}>Delete</button></td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">No sales yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
