import { describe, it, expect } from "vitest";
import { calcStay } from "./lodge";

describe("calcStay", () => {
  it("computes nights, revenue and balance", () => {
    const r = calcStay({ check_in: "2026-10-20", check_out: "2026-10-23", rate_per_night: 500, laundry_cost: 80, amount_paid: 1000 });
    expect(r.nights).toBe(3);
    expect(r.room_revenue).toBe(1500);
    expect(r.total_revenue).toBe(1580);
    expect(r.balance).toBe(580);
  });
});
