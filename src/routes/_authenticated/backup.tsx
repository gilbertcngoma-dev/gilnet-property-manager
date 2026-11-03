import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, Upload, Cloud } from "lucide-react";
import { exportBackup, importBackup, isBackup } from "@/lib/localdb";
import { todayISO } from "@/lib/lodge";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "Backup — GILNET Property Manager" },
      { name: "description", content: "Export, import or back up property records saved on this computer." },
      { property: "og:title", content: "Backup — GILNET Property Manager" },
      { property: "og:description", content: "Export, import or back up property records saved on this computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function BackupPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [cloudOpen, setCloudOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onExport() {
    const b = await exportBackup();
    download(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }), `chaniche-lodge-backup-${todayISO()}.json`);
    setMsg(`Backup downloaded: ${b.stays.length} bookings, ${b.restaurant_sales.length} sales, ${b.rooms.length} rooms.`);
  }

  async function onImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isBackup(parsed)) { setMsg("That file is not a Chaniche Lodge backup."); return; }
      if (!confirm("Restore this backup? Matching records on this computer will be replaced; other records stay.")) return;
      const n = await importBackup(parsed);
      await qc.invalidateQueries();
      setMsg(`Restored ${n.stays} bookings, ${n.sales} sales and ${n.rooms} rooms.`);
    } catch {
      setMsg("Could not read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onCloud(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) { setMsg("No internet right now. Try Backup to Cloud when WiFi is back."); return; }
    setBusy(true); setMsg("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const r = await supabase.auth.signInWithPassword({ email, password });
        if (r.error) throw r.error;
        session = r.data.session;
      }
      const b = await exportBackup();
      const { error } = await supabase.from("lodge_backups").insert({ data: JSON.parse(JSON.stringify(b)) });
      if (error) throw error;
      setMsg("Backup saved to the cloud.");
      setCloudOpen(false); setPassword("");
    } catch (err) {
      setMsg(err instanceof Error ? `Cloud backup failed: ${err.message}` : "Cloud backup failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Backup</h1>
        <p className="text-sm text-muted-foreground">All records are saved on this computer. Export a backup file regularly, and import it on another device to share records.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export Backup</button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Import Backup</button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Backup file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); }} />
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <div className="border-t border-border pt-4">
        <button type="button" className="btn-ghost" onClick={() => setCloudOpen(!cloudOpen)}><Cloud className="mr-2 h-4 w-4" />Backup to Cloud (optional)</button>
        {cloudOpen && (
          <form onSubmit={onCloud} className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">Needs internet and your online staff email and password. Nothing is sent unless you press the button.</p>
            <div><label htmlFor="cb-email" className="label">Email</label><input id="cb-email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><label htmlFor="cb-pass" className="label">Password</label><input id="cb-pass" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload backup now"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
