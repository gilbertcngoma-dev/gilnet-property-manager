import { Link, Navigate, Outlet, createFileRoute, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { allowedPages, myRolesQuery } from "@/lib/lodge";
import { processSyncQueue, usePendingCount } from "@/lib/offline";
import { InstallAppButton } from "@/components/install-app";
import { OfflineBanner } from "@/components/offline-banner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
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

function Layout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId } = Route.useRouteContext();
  const { data: roles, isLoading } = useQuery(myRolesQuery(userId));
  const pending = usePendingCount();
  const { pathname } = useLocation();

  useEffect(() => {
    const sync = () => {
      void processSyncQueue().then((n) => {
        if (n > 0) qc.invalidateQueries();
      });
    };
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, [qc]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center p-4">Loading…</div>;
  }

  if (!roles || roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-sm space-y-4 text-center">
          <h1 className="font-display text-2xl font-bold">Waiting for approval</h1>
          <p className="text-sm text-muted-foreground">
            Your account was created, but the lodge manager still needs to approve it before you can open
            rooms, guests or sales. Please check back after they approve you.
          </p>
          <button type="button" className="btn w-full" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  const isAdmin = roles.includes("admin");
  const pages = allowedPages(roles);
  const visibleNav = pages === "all" ? nav : nav.filter((n) => pages.includes(n.to));
  if (pages !== "all" && !pages.includes(pathname)) {
    return <Navigate to={pages[0] as "/rooms"} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
        <div className="p-5">
          <div className="font-display text-xl font-bold">Lodge Manager</div>
          <div className="text-xs opacity-70">{pages === "all" ? "Front office" : roles.includes("housekeeping") ? "Housekeeping" : "Restaurant"}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {visibleNav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100"
              activeProps={{ className: "bg-primary text-primary-foreground opacity-100" }}>
              {n.label}
              {n.to === "/reservations" && pending > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-cleaning px-1.5 text-xs font-bold text-sidebar">{pending}</span>
              )}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/staff" activeOptions={{ exact: true }}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100"
              activeProps={{ className: "bg-primary text-primary-foreground opacity-100" }}>
              Staff
            </Link>
          )}
          <button type="button" className="whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium opacity-80 hover:opacity-100"
            onClick={signOut}>
            Sign out
          </button>
        </nav>
        <div className="border-t border-sidebar-foreground/20 px-3 py-2"><InstallAppButton /></div>
      </aside>
      <div className="flex flex-1 flex-col">
        <OfflineBanner />
        <main className="flex-1 p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
