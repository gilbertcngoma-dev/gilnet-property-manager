import { HardDrive } from "lucide-react";

export function OfflineBanner() {
  return (
    <div className="flex items-center gap-2 bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
      <HardDrive className="h-4 w-4" />
      <span>Offline Mode - Working Locally</span>
    </div>
  );
}
