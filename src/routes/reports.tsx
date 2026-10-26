import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { calcStay, kwacha, roomsQuery, staysQuery } from "@/lib/lodge";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Lodge Manager" },
      { name: "description", content: "Revenue by room type, payments and laundry income." },
      { property: "og:title", content: "Reports — Lodge Manager" },
      { property: "og:description", content: "Revenue by room type, payments and laundry income." },
    ],
  }),
  component: Reports,
});

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="space-y-3">
      {rows.map(([k, v]) => (
        <div key={k}>
          <div className="flex justify-between text-sm"><span>{k}</span><b>{kwacha(v)}</b></div>
          <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function Reports() {
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const typeOf = Object.fromEntries(rooms.map((r) => [r.room_no, r.room_type]));
  const byType: Record<string, number> = { Standard: 0, Twin: 0, Deluxe: 0, Suite: 0 };
   const byPay: Record<string, number> = { Cash: 0, Mobile: 0, "Visa/Card": 0, Compliment: 0, Pending: 0 };
  let laundry = 0;
  for (const s of stays) {
    const c = calcStay(s);
    const t = typeOf[s.room_no];
    if (t) byType[t] = (byType[t] ?? 0) + c.room_revenue;
    byPay[s.payment_method] = (byPay[s.payment_method] ?? 0) + Number(s.amount_paid);
    laundry += Number(s.laundry_cost);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card"><h2 className="mb-4 text-lg font-semibold">Room revenue by type</h2><Bars rows={Object.entries(byType)} /></div>
        <div className="card"><h2 className="mb-4 text-lg font-semibold">Payments received</h2><Bars rows={Object.entries(byPay)} /></div>
        <div className="card"><h2 className="mb-2 text-lg font-semibold">Laundry income</h2><div className="text-3xl font-bold">{kwacha(laundry)}</div><p className="mt-1 text-xs text-muted-foreground">From {stays.length} stays</p></div>
      </div>
    </div>
  );
}
