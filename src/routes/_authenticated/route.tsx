import { Link, Navigate, Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { allowedPages } from "@/lib/lodge";
import { seedRooms } from "@/lib/localdb";
import { getPins, isValidPin, roleForPin, setPin, setSessionRole, useSessionRole } from "@/lib/pin";
import { getProperty, isValidCode, saveProperty, type Property } from "@/lib/property";
import { InstallAppButton } from "@/components/install-app";
import { OfflineBanner } from "@/components/offline-banner";
import { StatusDot } from "@/components/status-dot";
import { syncNow } from "@/lib/sync";
import { pushCentralStatus } from "@/lib/central";
import { useQueryClient } from "@tanstack/react-query";

function AutoSync() {
  const qc = useQueryClient();
  useEffect(() => {
    let busy = false;
    const go = async () => {
      if (busy || !navigator.onLine) return;
      busy = true;
      try {
        const r = await syncNow();
        await pushCentralStatus();
        if (r.received) await qc.invalidateQueries();
      } catch { /* offline or not signed in: keep working locally */ }
      busy = false;
    };
    void go();
    const t = setInterval(go, 5 * 60 * 1000);
    window.addEventListener("online", go);
    return () => { clearInterval(t); window.removeEventListener("online", go); };
  }, [qc]);
  return null;
}

// The app runs entirely on this device; a PIN replaces online sign-in.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: Layout,
});

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/front-desk", label: "Front Desk" },
  { to: "/reservations", label: "Reservations" },
  { to: "/rooms", label: "Rooms" },
  { to: "/restaurant", label: "Restaurant" },
  { to: "/reports", label: "Reports" },
] as const;

const DEPT_LABEL = { admin: "Owner / Manager", staff: "Front office", housekeeping: "Housekeeping", restaurant: "Restaurant" } as const;

function PinGate() {
  const [hasManager, setHasManager] = useState<boolean | null>(null);
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [prop, setProp] = useState<Property>({ name: "", code: "", address: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => { void seedRooms(); void getPins().then((p) => setHasManager(!!p.admin)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!hasManager) {
      if (!prop.name.trim()) { setMsg("Enter the property name."); return; }
      if (!isValidCode(prop.code.trim().toUpperCase())) { setMsg("Property code must be 3 to 8 letters, e.g. KITWE."); return; }
      if (!isValidPin(pin)) { setMsg("Use 4 to 8 numbers for the PIN."); return; }
      if (pin !== confirm) { setMsg("The two PINs don't match."); return; }
      await saveProperty({ name: prop.name.trim(), code: prop.code.trim().toUpperCase(), address: prop.address.trim() });
      await setPin("admin", pin);
      setSessionRole("admin");
      return;
    }
    const role = await roleForPin(pin);
    if (!role) { setMsg("Wrong PIN."); setPinValue(""); return; }
    setSessionRole(role);
  }

  if (hasManager === null) return <div className="flex min-h-screen items-center justify-center p-4">Loading…</div>;
  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner />
      <div className="flex flex-1 items-center justify-center p-4">
        <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
          <h1 className="font-display text-2xl font-bold">GILNET PROPERTY MANAGER</h1>
          <p className="text-sm text-muted-foreground">
            {hasManager ? "Enter your PIN to open the app." : "First time on this computer: set up your property and create the owner PIN (4–8 numbers)."}
          </p>
          {!hasManager && (
            <>
              <div><label htmlFor="prop-name" className="label">Property name</label>
                <input id="prop-name" className="field" autoFocus value={prop.name} onChange={(e) => setProp({ ...prop, name: e.target.value })} placeholder="e.g. Gilnet Lodge" /></div>
              <div><label htmlFor="prop-code" className="label">Property code (3–8 letters)</label>
                <input id="prop-code" className="field" value={prop.code} onChange={(e) => setProp({ ...prop, code: e.target.value })} placeholder="e.g. KITWE" maxLength={12} /></div>
              <div><label htmlFor="prop-addr" className="label">Address (optional)</label>
                <input id="prop-addr" className="field" value={prop.address} onChange={(e) => setProp({ ...prop, address: e.target.value })} /></div>
            </>
          )}
          <div><label htmlFor="pin" className="label">{hasManager ? "PIN" : "New owner PIN"}</label>
            <input id="pin" type="password" inputMode="numeric" autoFocus={hasManager} className="field" value={pin} onChange={(e) => setPinValue(e.target.value)} /></div>
          {!hasManager && <div><label htmlFor="pin2" className="label">Repeat PIN</label>
            <input id="pin2" type="password" inputMode="numeric" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>}
          {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
          <button className="btn w-full">{hasManager ? "Open" : "Save and open"}</button>
        </form>
      </div>
    </div>
  );
}

function Layout() {
  const role = useSessionRole();
  const { pathname } = useLocation();
  const [prop, setProp] = useState<Property | null>(null);
  useEffect(() => { void seedRooms(); void getProperty().then(setProp); }, []);
  if (!role) return <PinGate />;

  const pages = allowedPages([role]);
  const visibleNav = pages === "all" ? nav : nav.filter((n) => pages.includes(n.to));
  if (pages !== "all" && !pages.includes(pathname)) return <Navigate to={pages[0] as "/rooms"} replace />;
  const linkCls = "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100";
  const active = { className: "bg-primary text-primary-foreground opacity-100" };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AutoSync />
      <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
        <div className="p-5">
          <div className="font-display text-lg font-bold leading-tight">GILNET PROPERTY MANAGER</div>
          <div className="mt-1 text-xs opacity-70">{prop?.name ? `${prop.name} · ` : ""}{DEPT_LABEL[role]}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {visibleNav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }} className={linkCls} activeProps={active}>{n.label}</Link>
          ))}
          {pages === "all" && <Link to="/backup" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>Backup</Link>}
          {role === "admin" && <Link to="/settings" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>Settings</Link>}
          {role === "admin" && <Link to="/sync" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>Cloud sync</Link>}
          {role === "admin" && <Link to="/owner" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>All Lodges</Link>}
          {role === "admin" && <Link to="/staff" activeOptions={{ exact: true }} className={linkCls} activeProps={active}>PINs</Link>}
          <button type="button" className={`${linkCls} text-left`} onClick={() => setSessionRole(null)}>Lock</button>
        </nav>
        <div className="border-t border-sidebar-foreground/20 px-3 py-2"><InstallAppButton /></div>
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-end gap-2 p-3">
          <StatusDot />
        </div>
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
