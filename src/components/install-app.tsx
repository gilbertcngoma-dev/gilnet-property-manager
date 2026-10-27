import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Download, ExternalLink, Info, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "checking" | "installed" | "preview" | "ready" | "manual" | "unsupported";
const InstallContext = createContext<{
  state: InstallState;
  busy: boolean;
  error: string;
  install: () => Promise<void>;
}>({ state: "checking", busy: false, error: "", install: async () => {} });

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [environment, setEnvironment] = useState<InstallState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const hostname = window.location.hostname.toLowerCase();
    const preview = window.self !== window.top || hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      (/\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(hostname) &&
        /^(?:(?:id-preview|preview)(?:-[a-z0-9]+)?--|project--.+-dev\.)/.test(hostname)) ||
      /(^|\.)(lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(hostname);
    const updateEnvironment = () => {
      const standalone = media.matches || (navigator as Navigator & { standalone?: boolean }).standalone || /Electron\//.test(navigator.userAgent);
      setEnvironment(standalone ? "installed" : preview ? "preview" : /(?:Chrome|Edg)\//.test(navigator.userAgent) ? "manual" : "unsupported");
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setError("");
    };
    const onInstalled = () => {
      setEnvironment("installed");
      setPrompt(null);
    };
    updateEnvironment();
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    media.addEventListener("change", updateEnvironment);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media.removeEventListener("change", updateEnvironment);
    };
  }, []);

  const state = environment === "manual" && prompt ? "ready" : environment;
  const install = async () => {
    if (!prompt || state !== "ready" || busy) return;
    setBusy(true);
    setError("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setEnvironment("installed");
    } catch {
      setError("The install prompt could not open. Use the Chrome or Edge menu below instead.");
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  };

  return <InstallContext.Provider value={{ state, busy, error, install }}>{children}</InstallContext.Provider>;
}

const labels: Record<InstallState, string> = {
  checking: "Checking availability…",
  installed: "Already installed",
  preview: "Open the app link to install",
  ready: "Installation available",
  manual: "Use your browser menu",
  unsupported: "Open in Chrome or Edge",
};

export function InstallAppButton() {
  const { state, busy, error, install } = useContext(InstallContext);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start whitespace-normal py-3 text-left hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground">
          {state === "installed" ? <CheckCircle2 /> : <Download />}
          <span className="min-w-0"><span className="block font-semibold">Install app</span><span className="block text-xs font-normal opacity-80">{labels[state]}</span></span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle className="pr-6 font-display">Install Chaniche Lodge</DialogTitle>
          <DialogDescription>Open Chaniche Lodge from your computer’s app icon, in its own window without the builder chat. Internet is required.</DialogDescription>
        </DialogHeader>
        <div role="status" className="flex items-start gap-3 border-y py-4">
          {state === "installed" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" /> : <Info className="mt-0.5 size-5 shrink-0 text-primary" />}
          <div className="space-y-1 text-sm">
            <p className="font-semibold">{labels[state]}</p>
            <p className="text-muted-foreground">
              {state === "preview" ? "Installation is not available inside the builder preview. Open the app link below in Chrome or Edge on your computer." :
                state === "installed" ? "You are using the installed app, or this browser has just confirmed installation." :
                state === "ready" ? "Your browser is ready. Select Install now, then confirm in the browser’s prompt." :
                state === "manual" ? "No one-click install prompt is available right now. Check your browser menu; it may also show Open in app if you have already installed it." :
                state === "unsupported" ? "For desktop installation, open the app link in Google Chrome or Microsoft Edge." : "Checking this browser…"}
            </p>
          </div>
        </div>
        {state === "ready" && <Button onClick={install} disabled={busy}><Download />{busy ? "Opening install prompt…" : "Install now"}</Button>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {state !== "installed" && <>
          <div className="space-y-4 text-sm">
            <section className="space-y-1"><h3 className="font-semibold">Google Chrome</h3><p className="text-muted-foreground">Open the app link, then select ⋮ → Cast, save, and share → Install page as app… and confirm. You can also select the install icon in the address bar when it appears.</p></section>
            <section className="space-y-1"><h3 className="font-semibold">Microsoft Edge</h3><p className="text-muted-foreground">Open the app link, then select … → Apps → Install this site as an app and confirm. If offered, choose Create desktop shortcut or Pin to taskbar.</p></section>
            <p className="text-xs text-muted-foreground">Menu wording can vary with browser version. If no install option appears, update Chrome or Edge and try again. Your existing sign-in and lodge records stay the same.</p>
          </div>
          <Button asChild variant="outline"><a href="https://lodgeflow-stay-and-revenue.lovable.app" target="_blank" rel="noopener noreferrer"><ExternalLink />Open app link</a></Button>
        </>}
        {state === "installed" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Monitor className="size-4 shrink-0" />Find Chaniche Lodge in your computer’s apps or Start menu.</p>}
      </DialogContent>
    </Dialog>
  );
}