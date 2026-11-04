import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { countDuplicateRooms, dedupeRooms } from "@/lib/localdb";
import { getProperty, type Property } from "@/lib/property";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GILNET PROPERTY MANAGER" },
      { name: "description", content: "Property details and room repair tools." },
      { property: "og:title", content: "Settings — GILNET PROPERTY MANAGER" },
      { property: "og:description", content: "Property details and room repair tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Settings() {
  const qc = useQueryClient();
  const [prop, setProp] = useState<Property | null>(null);
  const [dupes, setDupes] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const check = () => countDuplicateRooms().then(setDupes).catch(() => setDupes(0));
  useEffect(() => { void getProperty().then(setProp); void check(); }, []);

  async function fix() {
    try {
      const { removed, kept } = await dedupeRooms();
      setMsg(`Removed ${removed} duplicates, kept ${kept} unique`);
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      void check();
    } catch { setMsg("Could not fix rooms on this computer."); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Property</h2>
        <div>Name: <b>{prop?.name ?? "—"}</b></div>
        <div>Code: <b>{prop?.code || "—"}</b></div>
        <div>Address: {prop?.address || "—"}</div>
      </div>
      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Tools</h2>
        <p className="text-sm text-muted-foreground">{dupes === null ? "Checking rooms…" : `Found ${dupes} duplicate room${dupes === 1 ? "" : "s"}`}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={fix}>Delete Duplicate Rooms</button>
          <button type="button" className="btn-ghost" onClick={fix}>Fix All Rooms Now</button>
        </div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
      </div>
    </div>
  );
}
