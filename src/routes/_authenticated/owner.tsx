import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchCentralStatuses, syncHealth, type CentralStatus } from "@/lib/central";
import { getProperty } from "@/lib/property";
import { kwacha } from "@/lib/lodge";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "All Lodges — GILNET PROPERTY MANAGER" },
      { name: "description", content: "Owner overview: live status of every lodge." },
      { property: "og:title", content: "All Lodges — GILNET PROPERTY MANAGER" },
      { property: "og:description", content: "Owner overview: live status of every lodge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Owner,
});

const DOT = { green: "bg-green-500", yellow: "bg-yellow-500", red: "bg-red-500" } as const;
const LABEL = { green: "Reported recently", yellow: "Quiet for a few hours", red: "No report for over 12 hours" } as const;

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function Owner() {
  const [rows, setRows] = useState<CentralStatus[] | null>(null);
  const [err, setErr] = useState("");
  const [mine, setMine] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setErr("");
    try {
      setRows(await fetchCentralStatuses());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load lodge statuses.");
      setRows(null);
    }
    setBusy(false);
  }

  useEffect(() => {
    void getProperty().then((p) => setMine(p?.code ?? ""));
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">All my lodges</h1>
        <button type="button" className="btn-ghost" onClick={load} disabled={busy}>{busy ? "Loading…" : "Refresh"}</button>
      </div>
      {err && (
        <div className="card space-y-2">
          <p role="alert" className="text-sm text-destructive">{err}</p>
          <p className="text-sm text-muted-foreground">
            This page needs internet and a cloud sign-in. Go to <Link to="/sync" className="underline">Cloud sync</Link> first.
          </p>
        </div>
      )}
      {!err && rows === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {rows?.length === 0 && (
        <div className="card text-sm text-muted-foreground">
          No lodges have reported yet. Each lodge reports automatically after its first cloud sync.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows?.map((r) => {
          const health = syncHealth(r.last_sync_at);
          const isMine = r.property_code === mine;
          return (
            <div key={r.property_code} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{r.property_name || r.property_code}</div>
                  <div className="text-xs text-muted-foreground">{r.property_code}{isMine ? " · this computer" : ""}</div>
                </div>
                <span className={`mt-1 inline-block h-3 w-3 rounded-full ${DOT[health]}`} title={LABEL[health]} />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">Guests today</span><b className="text-right">{r.total_guests_today}</b>
                <span className="text-muted-foreground">Sales today</span><b className="text-right">{kwacha(Number(r.total_sales_today))}</b>
                <span className="text-muted-foreground">Cash collected</span><b className="text-right">{kwacha(Number(r.cash_collected_today))}</b>
                <span className="text-muted-foreground">Rooms occupied</span><b className="text-right">{r.rooms_occupied}</b>
                <span className="text-muted-foreground">Rooms available</span><b className="text-right">{r.rooms_available}</b>
              </div>
              <div className="border-t pt-2 text-xs text-muted-foreground">
                {r.last_checkin_name
                  ? <>Last check-in: <b>{r.last_checkin_name}</b>{r.last_checkin_time ? ` · ${timeAgo(r.last_checkin_time)}` : ""}</>
                  : "No check-ins today"}
                <div>Last report: {timeAgo(r.last_sync_at)} — {LABEL[health]}</div>
              </div>
              {!isMine && (
                <Link to="/sync" className="btn-ghost inline-block text-sm">Switch to this lodge</Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Lodges report automatically after each cloud sync (every 5 minutes when online). Green = reported in the last 2 hours, yellow = 2–12 hours, red = over 12 hours.
      </p>
    </div>
  );
}
