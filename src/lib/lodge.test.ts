import { describe, it, expect } from "vitest";
import { calcStay, PAYMENT_METHODS, canExtendStay, upcomingReservations, checkoutHistory, type Stay } from "./lodge";

const stay = (over: Partial<Stay>): Stay => ({
  id: "x", guest_name: "G", check_in: "2026-10-20", check_out: "2026-10-22", room_no: "01",
  rate_per_night: 0, laundry_cost: 0, amount_paid: 0, payment_method: "Cash", phone: null, guest_requests: null, status: "Confirmed", ...over,
});

describe("calcStay", () => {
  it("computes nights, revenue and balance", () => {
    const r = calcStay({ check_in: "2026-10-20", check_out: "2026-10-23", rate_per_night: 500, laundry_cost: 80, amount_paid: 1000 });
    expect(r.nights).toBe(3);
    expect(r.room_revenue).toBe(1500);
    expect(r.total_revenue).toBe(1580);
    expect(r.balance).toBe(580);
  });
});

it("offers pending alongside existing payment options", () => {
  expect([...PAYMENT_METHODS]).toEqual(["Cash", "Mobile", "Visa/Card", "Compliment", "Pending"]);
});

it("only extends to a later check-out date", () => {
  expect(canExtendStay("2026-10-26", "2026-10-27")).toBe(true);
  expect(canExtendStay("2026-10-26", "2026-10-26")).toBe(false);
  expect(canExtendStay("2026-10-26", "2026-10-25")).toBe(false);
});

it("recalculates charges after a stay extension without changing payments", () => {
  expect(calcStay({ check_in: "2026-10-20", check_out: "2026-10-24", rate_per_night: 500, laundry_cost: 80, amount_paid: 1000 })).toEqual({ nights: 4, room_revenue: 2000, total_revenue: 2080, balance: 1080 });
});

it("lists only future check-ins as reservations, earliest first", () => {
  const today = "2026-10-29";
  const stays = [
    stay({ id: "past", check_in: "2026-10-01", check_out: "2026-10-03" }),
    stay({ id: "today", check_in: "2026-10-29", check_out: "2026-10-31" }),
    stay({ id: "later", check_in: "2026-11-05", check_out: "2026-11-07" }),
    stay({ id: "soon", check_in: "2026-11-01", check_out: "2026-11-02" }),
  ];
  expect(upcomingReservations(stays, today).map((s) => s.id)).toEqual(["soon", "later"]);
});

it("lists only past check-outs as history, most recent first", () => {
  const today = "2026-10-29";
  const stays = [
    stay({ id: "current", check_in: "2026-10-25", check_out: "2026-11-02" }),
    stay({ id: "old", check_in: "2026-09-01", check_out: "2026-09-03" }),
    stay({ id: "recent", check_in: "2026-10-20", check_out: "2026-10-28" }),
    stay({ id: "leaving-today", check_in: "2026-10-27", check_out: "2026-10-29" }),
  ];
  expect(checkoutHistory(stays, today).map((s) => s.id)).toEqual(["recent", "old"]);
});
