import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createStaffAccount } from "@/lib/staff.functions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allRolesQuery, myRolesQuery, profilesQuery, type AppRole } from "@/lib/lodge";
import { Route as AuthedRoute } from "./route";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff access — Lodge Manager" },
      { name: "description", content: "Approve or remove staff access to the lodge app." },
      { property: "og:title", content: "Staff access — Chaniche Lodge" },
      { property: "og:description", content: "Approve or remove staff access to the lodge app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  const { userId } = AuthedRoute.useRouteContext();
  const queryClient = useQueryClient();
  const { data: myRoles } = useQuery(myRolesQuery(userId));
  const isAdmin = myRoles?.includes("admin") ?? false;

  const { data: profiles, isLoading: loadingProfiles } = useQuery({ ...profilesQuery, enabled: isAdmin });
  const { data: roles, isLoading: loadingRoles } = useQuery({ ...allRolesQuery, enabled: isAdmin });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["all-roles"] });
  };

  const approve = useMutation({
    mutationFn: async ({ userId: uid, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  if (!isAdmin) {
    return <p className="text-muted-foreground">Only the lodge manager (admin) can open this page.</p>;
  }

  if (loadingProfiles || loadingRoles) return <p>Loading…</p>;

  const rolesFor = (uid: string) => (roles ?? []).filter((r) => r.user_id === uid).map((r) => r.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Staff access</h1>
        <p className="text-sm text-muted-foreground">
          New accounts can sign in only after you approve them here. Removing access signs them out of the data immediately.
        </p>
      </div>
      <CreateStaff onDone={refresh} />
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Email</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Access</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const r = rolesFor(p.id);
              const approved = r.length > 0;
              const isSelf = p.id === userId;
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3">{p.email ?? "—"}{isSelf ? " (you)" : ""}</td>
                  <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                  <td className="p-3">
                    {approved ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                        {r.includes("admin") ? "Admin" : "Staff"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">Pending</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {!approved && (
                        <button type="button" className="btn px-3 py-1 text-xs"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate({ userId: p.id, role: "staff" })}>
                          Approve
                        </button>
                      )}
                      {approved && !isSelf && (
                        <button type="button" className="rounded-md border px-3 py-1 text-xs"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(p.id)}>
                          Remove access
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateStaff({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createStaffAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      await create({ data: { email, password } });
      setMsg(`Account created for ${email}. They can sign in now with that password.`);
      setEmail(""); setPassword(""); onDone();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not create the account.");
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card flex flex-wrap items-end gap-3">
      <div className="w-full font-semibold">Create a staff account</div>
      <div><label htmlFor="staff-email" className="label">Email</label><input id="staff-email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label htmlFor="staff-password" className="label">Password</label><input id="staff-password" type="text" required minLength={6} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      <button className="btn" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
      {msg && <p role="status" className="w-full text-sm text-muted-foreground">{msg}</p>}
    </form>
  );
}
