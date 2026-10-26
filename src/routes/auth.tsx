import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff sign in — Lodge Manager" },
      { name: "description", content: "Sign in to manage rooms, guests and sales." },
      { property: "og:title", content: "Staff sign in — Lodge Manager" },
      { property: "og:description", content: "Sign in to manage rooms, guests and sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      setMsg(error ? error.message : "Check your email to confirm your account, then sign in.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="font-display text-2xl font-bold">Lodge Manager</h1>
        <p className="text-sm text-muted-foreground">{mode === "in" ? "Staff sign in" : "Create a staff account"}</p>
        <div><label htmlFor="email" className="label">Email</label><input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><label htmlFor="password" className="label">Password</label><input id="password" type="password" required minLength={6} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        {mode === "in" && (
          <button type="button" className="block text-sm underline" onClick={async () => {
            if (!email) return setMsg("Type your email above first, then tap Forgot password.");
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
            setMsg(error ? error.message : "Check your email for a link to set a new password.");
          }}>Forgot password?</button>
        )}
        <button type="button" className="text-sm underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>
          {mode === "in" ? "New staff? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
