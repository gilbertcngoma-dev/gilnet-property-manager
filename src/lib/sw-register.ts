// Guarded service-worker registration for offline support.
// Never registers in dev, iframes, or Lovable preview hosts; supports ?sw=off kill switch.

const PREVIEW_HOST = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/;
const BLOCKED_HOSTS = ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"];

function refused() {
  const host = window.location.hostname.toLowerCase();
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (PREVIEW_HOST.test(host)) return true;
  if (BLOCKED_HOSTS.some((h) => host === h || host.endsWith("." + h))) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterStale() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
  );
}

export function registerAppSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (refused()) {
    void unregisterStale();
    return;
  }
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").then(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.onLine) return;
      // Save every page once so the app opens during a blackout with no WiFi.
      for (const p of ["/", "/front-desk", "/reservations", "/rooms", "/restaurant", "/reports", "/backup", "/staff"]) {
        void fetch(p, { credentials: "same-origin" }).catch(() => {});
      }
    });
  });
}
