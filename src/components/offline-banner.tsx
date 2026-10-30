import { Plane } from "lucide-react";
import { useOnlineStatus, usePendingCount } from "@/lib/offline";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const pending = usePendingCount();
  if (online) return null;
  return (
    <div className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
      <Plane className="h-4 w-4" />
      <span>
        Offline Mode — Queued {pending} booking{pending === 1 ? "" : "s"} will sync when online
      </span>
    </div>
  );
}
