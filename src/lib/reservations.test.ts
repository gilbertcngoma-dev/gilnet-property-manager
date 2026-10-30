import { describe, expect, it } from "vitest";
import { filterReservations, type Stay } from "./lodge";

const TODAY = "2026-10-30";

const mk = (over: Partial<Stay>): Stay => ({
  id: over.id ?? crypto.randomUUID(),
  guest_name: "Guest",
  check_in: TODAY,
  check_out: "2026-10-31",
  room_no: "01",
  rate_per_night: 700,
  laundry_cost: 0,
  amount_paid: 0,
  payment_method: "Pending",
  phone: null,
  guest_requests: null,
  status: "Confirmed",
  ...over,
});

const sample: Stay[] = [
  mk({ guest_name: "John Banda", room_no: "02", check_in: "2026-10-29", check_out: "2026-11-01", status: "Confirmed" }),
  mk({ guest_name: "Sarah Phiri", room_no: "05", check_in: "2026-10-31", check_out: "2026-11-02", status: "Pending" }),
  mk({ guest_name: "David Mwale", room_no: "03", check_in: "2026-10-30", check_out: "2026-10-31", status: "Checked-in" }),
];

describe("filterReservations", () => {
  it("All returns every booking sorted by check-in", () => {
    const r = filterReservations(sample, "All", "", TODAY);
    expect(r.map((s) => s.guest_name)).toEqual(["John Banda", "David Mwale", "Sarah Phiri"]);
  });

  it("Today keeps bookings spanning today", () => {
    const r = filterReservations(sample, "Today", "", TODAY);
    expect(r.map((s) => s.guest_name)).toEqual(["John Banda", "David Mwale"]);
  });

  it("Upcoming keeps only future check-ins", () => {
    const r = filterReservations(sample, "Upcoming", "", TODAY);
    expect(r.map((s) => s.guest_name)).toEqual(["Sarah Phiri"]);
  });

  it("searches by guest name, room, or status", () => {
    expect(filterReservations(sample, "All", "phiri", TODAY).map((s) => s.guest_name)).toEqual(["Sarah Phiri"]);
    expect(filterReservations(sample, "All", "03", TODAY).map((s) => s.guest_name)).toEqual(["David Mwale"]);
    expect(filterReservations(sample, "All", "checked-in", TODAY).map((s) => s.guest_name)).toEqual(["David Mwale"]);
    expect(filterReservations(sample, "All", "nobody", TODAY)).toEqual([]);
  });
});
