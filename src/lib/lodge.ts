import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Room = {
  id: string;
  room_no: string;
  room_type: "Standard" | "Twin" | "Deluxe" | "Suite";
  status: "Vacant" | "Occupied" | "Cleaning";
  floor: number;
};

export type Stay = {
  id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  room_no: string;
  rate_per_night: number;
  laundry_cost: number;
  amount_paid: number;
  payment_method: "Cash" | "Mobile" | "Visa/Card" | "Compliment" | "Pending" | "Airtel" | "Bank";
};

export const PAYMENT_METHODS = ["Cash", "Mobile", "Visa/Card", "Compliment", "Pending"] as const;

export function canExtendStay(currentCheckout: string, newCheckout: string) {
  return Number.isFinite(Date.parse(newCheckout)) && newCheckout > currentCheckout;
}

export function currentStayForRoom(stays: Stay[], roomNo: string, today: string) {
  return stays.filter((s) => s.room_no === roomNo && s.check_in <= today)
    .sort((a, b) => b.check_in.localeCompare(a.check_in))[0];
}

export function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const ms = Date.parse(checkOut) - Date.parse(checkIn);
  return Math.max(0, Math.round(ms / 86400000));
}

export function calcStay(s: Pick<Stay, "check_in" | "check_out" | "rate_per_night" | "laundry_cost" | "amount_paid">) {
  const nights = nightsBetween(s.check_in, s.check_out);
  const room_revenue = nights * Number(s.rate_per_night || 0);
  const total_revenue = room_revenue + Number(s.laundry_cost || 0);
  const balance = total_revenue - Number(s.amount_paid || 0);
  return { nights, room_revenue, total_revenue, balance };
}

export const kwacha = (n: number) =>
  "K " + n.toLocaleString("en-ZM", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const roomsQuery = queryOptions({
  queryKey: ["rooms"],
  queryFn: async () => {
    const { data, error } = await supabase.from("rooms").select("*").order("room_no");
    if (error) throw error;
    return data as Room[];
  },
});

export const staysQuery = queryOptions({
  queryKey: ["stays"],
  queryFn: async () => {
    const { data, error } = await supabase.from("stays").select("*").order("check_in", { ascending: false });
    if (error) throw error;
    return data as Stay[];
  },
});

export type AppRole = "admin" | "staff";

export type Profile = { id: string; email: string | null; created_at: string };

export const myRolesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

export const profilesQuery = queryOptions({
  queryKey: ["profiles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at");
    if (error) throw error;
    return data as Profile[];
  },
});

export const allRolesQuery = queryOptions({
  queryKey: ["all-roles"],
  queryFn: async () => {
    const { data, error } = await supabase.from("user_roles").select("*");
    if (error) throw error;
    return data as { id: string; user_id: string; role: AppRole }[];
  },
});
