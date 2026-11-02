import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/lodge";
import { getPins, isValidPin, setPin, useSessionRole, type PinMap } from "@/lib/pin";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "PINs — Lodge Manager" },
      { name: "description", content: "Set the PIN each department uses on this computer." },
      { property: "og:title", content: "PINs — Lodge Manager" },
      { property: "og:description", content: "Set the PIN each department uses on this computer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pins,
});

const DEPTS: { role: AppRole; label: string; note: string }[] = [
  { role: "admin", label: "Manager", note: "Everything, plus PINs" },
  { role: "staff", label: "Front office", note: "All lodge pages and Backup" },
  { role: "housekeeping", label: "Housekeeping", note: "Rooms only" },
  { role: "restaurant", label: "Restaurant", note: "Restaurant sales only" },
];

function Pins() {
  const role = useSessionRole();
  const [pins, setPins] = useState<PinMap>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const load = () => getPins().then(setPins);
  useEffect(() => { void load(); }, []);
  if (role !== "admin") return <Navigate to="/" replace />;

  async function save(r: AppRole) {
    const v = values[r] ?? "";
    if (!isValidPin(v)) { setMsg("A PIN must be 4 to 8 numbers."); return; }
    await setPin(r, v);
    setValues({ ...values, [r]: "" });
    setMsg("PIN saved."); void load();
  }
  async function remove(r: AppRole) {
    if (!confirm("Remove this PIN? That department will no longer be able to open the app on this computer.")) return;
    await setPin(r, null); setMsg("PIN removed."); void load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Department PINs</h1>
        <p className="text-sm text-muted-foreground">PINs are saved on this computer only. Set them again on each device.</p>
      </div>
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {DEPTS.map((d) => (
          <div key={d.role} className="card space-y-3">
            <div className="flex items-center justify-between">
              <div><div className="font-semibold">{d.label}</div><div className="text-xs text-muted-foreground">{d.note}</div></div>
              <span className="text-xs">{pins[d.role] ? "PIN set" : "No PIN"}</span>
            </div>
            <div className="flex gap-2">
              <input aria-label={`${d.label} PIN`} type="password" inputMode="numeric" className="field" placeholder="New PIN" value={values[d.role] ?? ""} onChange={(e) => setValues({ ...values, [d.role]: e.target.value })} />
              <button type="button" className="btn" onClick={() => save(d.role)}>Save</button>
              {pins[d.role] && d.role !== "admin" && <button type="button" className="btn-ghost" onClick={() => remove(d.role)}>Remove</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
