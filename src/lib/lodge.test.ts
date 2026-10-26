import { describe, it, expect } from "vitest";
import { calcStay, PAYMENT_METHODS, canExtendStay } from "./lodge";

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
