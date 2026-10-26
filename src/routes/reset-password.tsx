import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — Lodge Manager" },
      { name: "description", content: "Choose a new password for your lodge staff account." },
      { property: "og:title", content: "Set a new password — Lodge Manager" },
      { property: "og:description", content: "Choose a new password for your lodge staff account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg(error.message + " Open the link from your newest email and try again.");
    setMsg("Password changed. Opening the app…");
    setTimeout(() => navigate({ to: "/" }), 1000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-bold">Set a new password</h1>
        <div><label htmlFor="new-password" className="label">New password</label><input id="new-password" type="password" required minLength={6} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : "Save new password"}</button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}
