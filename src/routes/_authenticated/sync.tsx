import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cloudUser, lastSync, syncNow } from "@/lib/sync";

export const Route = createFileRoute("/_authenticated/sync")({
  head: () => ({
    meta: [
      { title: "Cloud sync — GILNET Property Manager" },
      { name: "description", content: "Sign in to the property cloud account so all computers share the same records." },
      { property: "og:title", content: "Cloud sync — GILNET Property Manager" },
      { property: "og:description", content: "Sign in to the property cloud account so all computers share the same records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SyncPage,
});

function SyncPage() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => { setUser((await cloudUser())?.email ?? null); setLast(await lastSync()); };
  useEffect(() => { void refresh(); }, []);

  async function run() {
    setBusy(true); setMsg("");
    try {
      const r = await syncNow();
      await qc.invalidateQueries();
      setMsg(`Synced: sent ${r.sent}, received ${r.received} changes.`);
      setLast(r.at);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Sync failed."); }
    finally { setBusy(false); }
  }

  async function auth(mode: "in" | "up") {
    if (!navigator.onLine) { setMsg("No internet right now."); return; }
    setBusy(true); setMsg("");
    const { supabase } = await import("@/integrations/supabase/client");
    const r = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (r.error) { setMsg(r.error.message); return; }
    if (mode === "up" && !r.data.session) { setMsg("Check your email to confirm the account, then sign in here."); return; }
    setPassword("");
    await refresh();
    await run();
  }

  async function signOut() {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.auth.signOut();
    await refresh();
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="font-display text-3xl font-bold">Cloud sync</h1>
      <p className="text-sm text-muted-foreground">
        The app always works offline. Sign in with your property's cloud account on every computer of this property — when there's internet,
        records are shared automatically every few minutes. The newest change wins.
      </p>
      {user === undefined ? <p>Checking…</p> : user ? (
        <div className="card space-y-3">
          <p className="text-sm">Signed in as <b>{user}</b></p>
          <p className="text-sm text-muted-foreground">Last sync: {last ? new Date(last).toLocaleString() : "never"}</p>
          <div className="flex gap-2">
            <button className="btn" disabled={busy} onClick={run}>{busy ? "Syncing…" : "Sync now"}</button>
            <button className="rounded-md border px-4 py-2 text-sm" onClick={signOut}>Sign out of cloud</button>
          </div>
        </div>
      ) : (
        <form className="card space-y-3" onSubmit={(e) => { e.preventDefault(); void auth("in"); }}>
          <div><label htmlFor="ce" className="label">Cloud account email</label>
            <input id="ce" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label htmlFor="cp" className="label">Password</label>
            <input id="cp" type="password" required minLength={6} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="flex gap-2">
            <button className="btn" disabled={busy}>Sign in</button>
            <button type="button" className="rounded-md border px-4 py-2 text-sm" disabled={busy} onClick={() => void auth("up")}>Create account</button>
          </div>
        </form>
      )}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
