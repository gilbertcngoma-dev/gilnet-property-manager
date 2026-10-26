import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roomsQuery, type Room } from "@/lib/lodge";

export const Route = createFileRoute("/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Lodge Manager" },
      { name: "description", content: "Colour-coded room status board." },
      { property: "og:title", content: "Rooms — Lodge Manager" },
      { property: "og:description", content: "Colour-coded room status board." },
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
  const rooms = useQuery(roomsQuery).data ?? [];
  const [n, setN] = useState({ room_no: "", room_type: "Standard", floor: 1 });

  async function cycle(r: Room) {
    await supabase.from("rooms").update({ status: next[r.status] }).eq("id", r.id);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!n.room_no) return;
    await supabase.from("rooms").insert(n);
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
        {rooms.map((r) => (
          <button key={r.id} onClick={() => cycle(r)} className={`rounded-xl p-4 text-left shadow-sm transition hover:scale-[1.03] ${tone[r.status]}`}>
            <div className="font-display text-2xl font-bold">{r.room_no}</div>
            <div className="text-xs opacity-90">{r.room_type} · Floor {r.floor}</div>
            <div className="mt-2 text-sm font-semibold">{r.status}</div>
          </button>
        ))}
      </div>
      <form onSubmit={add} className="card flex flex-wrap items-end gap-3">
        <div><label className="label">Room no</label><input className="field" value={n.room_no} onChange={(e) => setN({ ...n, room_no: e.target.value })} /></div>
        <div><label className="label">Type</label><select className="field" value={n.room_type} onChange={(e) => setN({ ...n, room_type: e.target.value })}><option>Standard</option><option>Twin</option><option>Deluxe</option><option>Suite</option></select></div>
        <div><label className="label">Floor</label><input type="number" className="field w-20" value={n.floor} onChange={(e) => setN({ ...n, floor: Number(e.target.value) })} /></div>
        <button className="btn">Add room</button>
      </form>
    </div>
  );
}
