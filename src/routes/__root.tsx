import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found.</p>
        <Link to="/" className="btn mt-6">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <button className="btn mt-6" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lodge Manager" },
      { name: "description", content: "Simple property management for Zambian lodges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/front-desk", label: "Front Desk" },
  { to: "/rooms", label: "Rooms" },
  { to: "/restaurant", label: "Restaurant" },
  { to: "/reports", label: "Reports" },
] as const;

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="bg-sidebar text-sidebar-foreground md:w-56 md:shrink-0">
          <div className="p-5">
            <div className="font-display text-xl font-bold">Lodge Manager</div>
            <div className="text-xs opacity-70">Front office</div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium opacity-80 hover:opacity-100"
                activeProps={{ className: "bg-primary text-primary-foreground opacity-100" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </QueryClientProvider>
  );
}
