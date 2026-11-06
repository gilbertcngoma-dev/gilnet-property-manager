import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { countDuplicateRooms, db, dedupeRooms, DATA_TABLES } from "@/lib/localdb";
import { getProperty, type Property } from "@/lib/property";
import { cloudUser, lastSync } from "@/lib/sync";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — GILNET PROPERTY MANAGER" },
      { name: "description", content: "Property details, cloud status, support and room repair tools." },
      { property: "og:title", content: "Settings — GILNET PROPERTY MANAGER" },
      { property: "og:description", content: "Property details, cloud status, support and room repair tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const SUPPORT_EMAIL = "support.gilnet.property.manager@gmail.com";

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Settings() {
  const qc = useQueryClient();
  const [prop, setProp] = useState<Property | null>(null);
  const [dupes, setDupes] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [backupMsg, setBackupMsg] = useState("");
  const [checking, setChecking] = useState(false);

  const check = () => countDuplicateRooms().then(setDupes).catch(() => setDupes(0));
  useEffect(() => {
    void getProperty().then(setProp);
    void check();
    void cloudUser().then((u) => setEmail(u?.email ?? null)).catch(() => setEmail(null));
    void lastSync().then(setSyncedAt);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function fix() {
    try {
      const { removed, kept } = await dedupeRooms();
      setMsg(`Removed ${removed} duplicates, kept ${kept} unique`);
      await qc.invalidateQueries({ queryKey: ["rooms"] });
      void check();
    } catch { setMsg("Could not fix rooms on this computer."); }
  }

  function sendSupport() {
    const code = prop?.code || "NO-CODE";
    const details = [
      `Property: ${prop?.name ?? "—"} (${code})`,
      `Address: ${prop?.address || "—"}`,
      `Cloud email: ${email ?? "not signed in"}`,
      `Last sync: ${syncedAt ?? "never"}`,
      "",
      "Issue:",
      body,
    ].join("\n");
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[GILNET SUPPORT - ${code}] ${subject}`)}&body=${encodeURIComponent(details)}`;
    window.location.href = url;
  }

  async function checkBackup() {
    setChecking(true);
    setBackupMsg("");
    try {
      const user = await cloudUser();
      if (!user) { setBackupMsg("Sign in on the Cloud sync page first."); return; }
      const code = prop?.code;
      if (!code) { setBackupMsg("Set a property code first."); return; }
      const { supabase } = await import("@/integrations/supabase/client");
      const d = db();
      const parts: string[] = [];
      for (const t of DATA_TABLES) {
        const { count, error } = await supabase.from("property_records")
          .select("id", { count: "exact", head: true })
          .eq("property_code", code).eq("table_name", t).eq("deleted", false);
        if (error) throw error;
        const localCount = await d[t].count();
        const label = t === "restaurant_sales" ? "restaurant sales" : t;
        parts.push(`${label}: ${localCount} here / ${count ?? 0} in cloud`);
      }
      setBackupMsg(parts.join(" · "));
    } catch {
      setBackupMsg("Could not reach the cloud. Check your internet.");
    } finally {
      setChecking(false);
    }
  }

  const nextIn = syncedAt ? SYNC_INTERVAL_MS - (now - Date.parse(syncedAt)) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Property</h2>
        <div>Name: <b>{prop?.name ?? "—"}</b></div>
        <div>Code: <b>{prop?.code || "—"}</b></div>
        <div>Address: {prop?.address || "—"}</div>
      </div>

      <div className="card space-y-1 text-sm">
        <h2 className="mb-2 text-lg font-semibold">Cloud</h2>
        <div>Master cloud email: <b>{email ?? "Not signed in — use the Cloud sync page"}</b></div>
        <div>Last sync: <b>{syncedAt ? new Date(syncedAt).toLocaleString() : "never"}</b></div>
        <div>Next sync: <b>{nextIn === null ? "—" : nextIn <= 0 ? "any moment" : fmtCountdown(nextIn)}</b> (every 5 minutes when online)</div>
        <div className="pt-2">
          <button type="button" className="btn-ghost" onClick={checkBackup} disabled={checking}>
            {checking ? "Checking…" : "Check Cloud Backup"}
          </button>
          {backupMsg && <p role="status" className="pt-2">{backupMsg}</p>}
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Support</h2>
        <p className="text-sm text-muted-foreground">Having a problem? Send us a message and we'll help.</p>
        <div>
          <label htmlFor="sup-subject" className="label">Subject</label>
          <input id="sup-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Receipt numbers not saving" />
        </div>
        <div>
          <label htmlFor="sup-body" className="label">Message</label>
          <textarea id="sup-body" className="field min-h-24" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe what happened…" />
        </div>
        <button type="button" className="btn" onClick={sendSupport} disabled={!subject.trim() || !body.trim()}>Email Support</button>
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
