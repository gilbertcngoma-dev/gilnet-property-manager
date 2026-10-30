import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { calcStay, checkoutHistory, kwacha, roomsQuery, staysQuery, todayISO, upcomingReservations, type Room, type Stay } from "@/lib/lodge";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lodge Manager" },
      { name: "description", content: "Occupancy, revenue and balances at a glance." },
      { property: "og:title", content: "Dashboard — Lodge Manager" },
      { property: "og:description", content: "Occupancy, revenue and balances at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const today = todayISO();
  const month = today.slice(0, 7);

  const occupied = rooms.filter((r) => r.status === "Occupied").length;
  const vacant = rooms.filter((r) => r.status === "Vacant").length;
  const pct = rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;
  const monthRevenue = stays.filter((s) => s.check_in.startsWith(month)).reduce((a, s) => a + calcStay(s).total_revenue, 0);
  const owed = stays.reduce((a, s) => a + Math.max(0, calcStay(s).balance), 0);
  const ins = stays.filter((s) => s.check_in === today);
  const outs = stays.filter((s) => s.check_out === today);
  const reservations = upcomingReservations(stays, today);
  const history = checkoutHistory(stays, today).slice(0, 10);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="label">Occupancy</div>
          <div className="text-3xl font-bold">{pct}%</div>
          <div className="mt-2 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-occupied" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 text-xs text-muted-foreground">{occupied} occupied · {vacant} vacant</div>
        </div>
        <div className="card"><div className="label">Revenue this month</div><div className="text-2xl font-bold">{kwacha(monthRevenue)}</div></div>
        <div className="card"><div className="label">Balances owed</div><div className="text-2xl font-bold text-destructive">{kwacha(owed)}</div></div>
        <div className="card"><div className="label">Today</div><div className="text-2xl font-bold">{ins.length} in · {outs.length} out</div></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Today's check-ins" items={ins} />
        <List title="Today's check-outs" items={outs} />
      </div>
      <div className="card">
        <h2 className="mb-3 text-lg font-semibold">Rooms</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {rooms.map((r) => <RoomCard key={r.id} room={r} />)}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Upcoming reservations</h2>
          {reservations.length === 0 ? <p className="text-sm text-muted-foreground">No future bookings.</p> : (
            <ul className="divide-y">
              {reservations.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex justify-between"><span>{s.guest_name}</span><span className="font-semibold">Room {s.room_no}</span></div>
                  <div className="text-xs text-muted-foreground">{s.check_in} → {s.check_out}{s.phone ? ` · ${s.phone}` : ""}</div>
                  {s.guest_requests && <div className="text-xs text-muted-foreground">Requests: {s.guest_requests}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Check-out history</h2>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No past check-outs yet.</p> : (
            <ul className="divide-y">
              {history.map((s) => { const k = calcStay(s); return (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex justify-between"><span>{s.guest_name}</span><span className="font-semibold">Room {s.room_no}</span></div>
                  <div className="text-xs text-muted-foreground">Left {s.check_out} · {k.nights} night{k.nights === 1 ? "" : "s"} · Total {kwacha(k.total_revenue)} · {s.payment_method}</div>
                </li>); })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const DOT: Record<Room["status"], string> = { Vacant: "bg-vacant", Occupied: "bg-occupied", Cleaning: "bg-cleaning" };

function RoomCard({ room }: { room: Room }) {
  return (
    <div className="rounded-lg border p-2 text-center text-sm">
      <div className="flex items-center justify-center gap-1.5 font-semibold">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${DOT[room.status]}`} />
        Room {room.room_no}
      </div>
      <div className="text-xs text-muted-foreground">{room.room_type} · {room.status}</div>
      {room.status === "Vacant" && (
        <Link to="/front-desk" search={{ guest: "", room: room.room_no, in: "", out: "", rate: 0 }} className="btn-ghost mt-2 w-full justify-center">Assign Guest</Link>
      )}
      {room.status === "Occupied" && (
        <Link to="/reservations" className="btn-ghost mt-2 w-full justify-center">View Reservation</Link>
      )}
    </div>
  );
}

function List({ title, items }: { title: string; items: { id: string; guest_name: string; room_no: string }[] }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">None today.</p> : (
        <ul className="divide-y">
          {items.map((s) => <li key={s.id} className="flex justify-between py-2 text-sm"><span>{s.guest_name}</span><span className="font-semibold">Room {s.room_no}</span></li>)}
        </ul>
      )}
    </div>
  );
}
