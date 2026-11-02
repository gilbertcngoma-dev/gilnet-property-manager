import { useSessionRole } from "@/lib/pin";
import { updateRoomOfflineFirst } from "@/lib/offline";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { local } from "@/lib/localdb";
import { roomsQuery, staysQuery, todayISO, calcStay, kwacha, canExtendStay, currentStayForRoom, allowedPages, type Room, type Stay } from "@/lib/lodge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Lodge Manager" },
      { name: "description", content: "Colour-coded room status board." },
      { property: "og:title", content: "Rooms — Lodge Manager" },
      { property: "og:description", content: "Colour-coded room status board." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rooms,
});

const tone: Record<Room["status"], string> = {
  Vacant: "bg-vacant text-primary-foreground",
  Occupied: "bg-occupied text-primary-foreground",
  Cleaning: "bg-cleaning text-foreground",
};
const next: Record<Room["status"], Room["status"]> = { Vacant: "Occupied", Occupied: "Cleaning", Cleaning: "Vacant" };

function Rooms() {
  const qc = useQueryClient();
  const role = useSessionRole();
  const frontOffice = !!role && allowedPages([role]) === "all";
  const rooms = useQuery(roomsQuery).data ?? [];
  const stays = useQuery(staysQuery).data ?? [];
  const [extending, setExtending] = useState<Stay | null>(null);
  const [checkout, setCheckout] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [n, setN] = useState({ room_no: "", room_type: "Standard", floor: 1 });

  async function extend(e: React.FormEvent) {
    e.preventDefault();
    if (!extending || !canExtendStay(extending.check_out, checkout)) { setMessage("Choose a date later than the current check-out."); return; }
    setSaving(true);
    const { data, error } = await local.from("stays").update({ check_out: checkout }).eq("id", extending.id).eq("check_out", extending.check_out).select("id");
    setSaving(false);
    if (error) { setMessage(error.message); return; }
    if (!data?.length) { setMessage("This stay changed. Refresh Rooms and try again."); return; }
    await qc.invalidateQueries({ queryKey: ["stays"] });
    setExtending(null); setMessage("Stay extended.");
  }

  async function cycle(r: Room) {
    qc.setQueryData<Room[]>(["rooms"], (old) => old?.map((x) => x.id === r.id ? { ...x, status: next[r.status] } : x));
    await updateRoomOfflineFirst(r.room_no, next[r.status]);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!n.room_no) return;
    await local.from("rooms").insert(n);
    setN({ ...n, room_no: "" });
    qc.invalidateQueries({ queryKey: ["rooms"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold">Rooms</h1>
        <div className="flex gap-3 text-xs">
          {(["Vacant", "Occupied", "Cleaning"] as const).map((s) => <span key={s} className="flex items-center gap-1"><i className={`h-3 w-3 rounded-full ${tone[s]}`} />{s}</span>)}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Tap a room to change its status.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {rooms.map((r) => { const guest = r.status === "Occupied" ? currentStayForRoom(stays, r.room_no, todayISO()) : undefined; return (
          <div key={r.id} className={`rounded-lg p-4 shadow-sm ${tone[r.status]}`}>
          <Button variant="ghost" onClick={() => cycle(r)} className="h-auto w-full flex-col items-start whitespace-normal p-0 text-left hover:bg-transparent">
            <div className="font-display text-2xl font-bold">{r.room_no}</div>
            <div className="text-xs opacity-90">{r.room_type} · Floor {r.floor}</div>
            <div className="mt-2 text-sm font-semibold">{r.status}</div>
          </Button>
          {guest && <><div className="mt-2 break-words text-xs">{guest.guest_name}<br />Until {guest.check_out}</div>{frontOffice && <Button variant="outline" size="sm" className="mt-3 w-full text-foreground" onClick={() => { setExtending(guest); setCheckout(guest.check_out); setMessage(""); }}>Extend stay</Button>}</>}
          </div>
        ); })}
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      {extending && <form onSubmit={extend} className="space-y-3 border-y border-border py-4">
        <h2 className="text-lg font-semibold">Extend stay — Room {extending.room_no}</h2>
        <p className="text-sm">{extending.guest_name} · Current check-out: {extending.check_out}</p>
        <div className="max-w-xs"><label htmlFor="extended-checkout" className="label">New check-out</label><input id="extended-checkout" type="date" required min={new Date(Date.parse(extending.check_out) + 86400000).toISOString().slice(0, 10)} className="field" value={checkout} onChange={(e) => setCheckout(e.target.value)} /></div>
        <p className="text-sm">{calcStay({ ...extending, check_out: checkout }).nights} nights · Total {kwacha(calcStay({ ...extending, check_out: checkout }).total_revenue)} · Balance {kwacha(calcStay({ ...extending, check_out: checkout }).balance)}</p>
        <div className="flex gap-2"><Button disabled={saving || !canExtendStay(extending.check_out, checkout)}>{saving ? "Saving…" : "Save extension"}</Button><Button type="button" variant="outline" onClick={() => setExtending(null)}>Cancel</Button></div>
      </form>}
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div><label className="label">Room no</label><input className="field" value={n.room_no} onChange={(e) => setN({ ...n, room_no: e.target.value })} /></div>
        <div><label className="label">Type</label><select className="field" value={n.room_type} onChange={(e) => setN({ ...n, room_type: e.target.value })}><option>Standard</option><option>Twin</option><option>Deluxe</option><option>Suite</option></select></div>
        <div><label className="label">Floor</label><input type="number" className="field w-20" value={n.floor} onChange={(e) => setN({ ...n, floor: Number(e.target.value) })} /></div>
        <button className="btn">Add room</button>
      </form>
    </div>
  );
}
