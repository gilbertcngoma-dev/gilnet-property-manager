import { useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Small top-right indicator: green when online, yellow when working locally. Never red. */
export function StatusDot() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
      <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-vacant" : "bg-cleaning"}`} />
      {online ? "Online" : "Offline — Working Locally"}
    </span>
  );
}
