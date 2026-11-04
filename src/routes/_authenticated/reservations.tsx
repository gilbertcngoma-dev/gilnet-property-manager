import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState } from "react";
import { BedDouble, CalendarDays, Plus, Search } from "lucide-react";
import { calcStay, filterReservations, kwacha, roomsQuery, staysQuery, todayISO, type ReservationPill, type Stay, STATUS_FILTERS, type StatusFilter } from "@/lib/lodge";

export const Route = createFileRoute("/_authenticated/reservations")({
  head: () => ({
    meta: [
      { title: "Reservations — Lodge Manager" },
      { name: "description", content: "Manage guest reservations and bookings." },
      { property: "og:title", content: "Reservations — Lodge Manager" },
      { property: "og:description", content: "Manage guest reservations and bookings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: zodValidator(z.object({ status: fallback(z.string(), "All").default("All") })),
  component: Reservations,
});

const PILLS: ReservationPill[] = ["All", "Today", "Upcoming"];

const BADGE: Record<Stay["status"], string> = {
  Confirmed: "badge-confirmed",
  Pending: "badge-pending",
  "Checked-in": "badge-checkedin",
  "Checked-out": "badge",
  Cancelled: "badge",
  "Later Date": "badge-pending",
};

const STATUS_KEY = "reservations-status-filter";

function Reservations() {
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const [q, setQ] = useState("");
  const [pill, setPill] = useState<ReservationPill>("All");
  const today = todayISO();
  const roomByNo = new Map(rooms.map((r) => [r.room_no, r]));
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/reservations" });
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(search.status) ? (search.status as StatusFilter) : "All";
  useEffect(() => {
    const saved = localStorage.getItem(STATUS_KEY);
    if (search.status === "All" && saved && saved !== "All" && (STATUS_FILTERS as readonly string[]).includes(saved)) navigate({ search: { status: saved }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setStatus = (v: string) => { localStorage.setItem(STATUS_KEY, v); navigate({ search: { status: v }, replace: true }); };
  const list = filterReservations(stays, pill, q, today, status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Reservations</h1>
          <p className="text-sm text-muted-foreground">Manage guest reservations &amp; bookings</p>
        </div>
        <Link to="/front-desk" search={{ guest: "", room: "", in: "", out: "", rate: 0 }} className="btn bg-info">
          <Plus className="mr-1 h-4 w-4" /> New Booking
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            className="field pl-9"
            placeholder="Search guests, room, booking or receipt no."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm font-medium whitespace-nowrap">Reservation Status</label>
          <select id="status-filter" className="field w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {PILLS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPill(p)}
              className={p === pill ? "btn" : "btn-ghost"}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card text-sm text-muted-foreground">No bookings match.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const k = calcStay(s);
            const room = roomByNo.get(s.room_no);
            return (
              <div key={s.id} className="card space-y-2 transition-shadow hover:shadow-md">
              <Link
                to="/front-desk"
                search={{ guest: s.guest_name, room: s.room_no, in: s.check_in, out: s.check_out, rate: s.rate_per_night }}
                className="block space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{s.guest_name}</span>
                  <span className={BADGE[s.status] ?? "badge"}>{s.status}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BedDouble className="h-4 w-4" />
                  {room ? `${room.room_type} Room ${s.room_no} · Floor ${room.floor}` : `Room ${s.room_no}`}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {s.check_in} → {s.check_out} · {k.nights} night{k.nights === 1 ? "" : "s"}
                </div>
                <div className="text-sm font-bold">
                  {kwacha(s.rate_per_night)}/night • Total: {kwacha(s.rate_per_night)} x {k.nights} = {kwacha(k.room_revenue)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Check-in: {s.check_in} · Payment: {s.payment_method}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Booking Down Payment:</span> {kwacha(Number(s.amount_paid))} paid / {kwacha(k.balance)} balance
                </div>
              </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
