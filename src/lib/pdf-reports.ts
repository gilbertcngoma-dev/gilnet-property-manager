// PDF reports built from this computer's data only — works with no internet.
import { calcStay, type Room, type Stay } from "@/lib/lodge";

export type Range = { from: string; to: string };
export type SaleRow = { id: string; sale_date: string; item: string; quantity: number; unit_price: number; room_no: string | null; payment_method: string; service_type: string; receipt_no?: string | null };

const APP = "GILNET PROPERTY MANAGER";
const money = (n: number) => "K " + n.toFixed(2);
const fileBase = (code: string) => `GILNET-PROPERTY-MANAGER_${code || "PROPERTY"}`;

/** Stays that overlap the date range. */
export const staysInRange = (stays: Stay[], r: Range) => stays.filter((s) => s.check_in <= r.to && s.check_out >= r.from && s.status !== "Cancelled");
export const salesInRange = (sales: SaleRow[], r: Range) => sales.filter((s) => s.sale_date >= r.from && s.sale_date <= r.to);

async function newDoc(title: string, propName: string, r: Range) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`${APP} - ${propName}`, 14, 14);
  doc.setFontSize(11);
  doc.text(`${title}  (${r.from} to ${r.to})`, 14, 21);
  return { doc, autoTable };
}

function finish(doc: import("jspdf").jsPDF, printedBy: string, name: string, mode: "download" | "print") {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Printed by ${printedBy} on ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.getHeight() - 6);
  }
  if (mode === "download") doc.save(name);
  else {
    const url = URL.createObjectURL(doc.output("blob"));
    const w = window.open(url);
    if (!w) doc.save(name);
  }
}

export async function roomStatusPdf(o: { rooms: Room[]; stays: Stay[]; range: Range; code: string; propName: string; printedBy: string; mode: "download" | "print" }) {
  const { doc, autoTable } = await newDoc("Room Check-In Status Report", o.propName, o.range);
  const inRange = staysInRange(o.stays, o.range);
  let occupied = 0, available = 0, unpaid = 0, revenue = 0;
  const body: string[][] = [];
  for (const room of o.rooms) {
    const list = inRange.filter((s) => s.room_no === room.room_no);
    if (!list.length) { available++; body.push([room.room_no, "", "", "", "Available", "", "", ""]); continue; }
    for (const s of list) {
      const c = calcStay(s);
      const reserved = s.status !== "Checked-in" && s.status !== "Checked-out";
      const isUnpaid = !reserved && (!s.receipt_no || c.balance > 0);
      if (s.status === "Checked-in") occupied++;
      if (isUnpaid) unpaid++;
      revenue += Number(s.amount_paid || 0);
      body.push([room.room_no, s.guest_name, s.check_in, s.check_out, reserved ? "Reserved" : isUnpaid ? "Unpaid" : "Paid", s.receipt_no ?? "", money(c.total_revenue), "Front desk"]);
    }
  }
  autoTable(doc, { startY: 26, head: [["Room No", "Guest Name", "Check-In Date", "Check-Out Date", "Status", "Receipt No", "Amount", "Front Desk User"]], body });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(`Total Occupied: ${occupied}    Available: ${available}    Unpaid: ${unpaid}    Revenue received: ${money(revenue)}`, 14, y);
  finish(doc, o.printedBy, `${fileBase(o.code)}_RoomStatus_${o.range.to}.pdf`, o.mode);
}

export async function restaurantPdf(o: { sales: SaleRow[]; range: Range; code: string; propName: string; printedBy: string; mode: "download" | "print" }) {
  const { doc, autoTable } = await newDoc("Restaurant Sales Report", o.propName, o.range);
  const list = salesInRange(o.sales, o.range).sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  let total = 0, cash = 0, unpaidAmt = 0;
  const body = list.map((s) => {
    const amt = Number(s.quantity) * Number(s.unit_price);
    total += amt;
    if (s.payment_method === "Cash") cash += amt;
    if (s.payment_method === "Pending") unpaidAmt += amt;
    return [s.sale_date, s.receipt_no ?? "", s.room_no ? `Room ${s.room_no}` : "Walk-in", s.item, String(s.quantity), money(amt), s.payment_method === "Pending" ? "Unpaid" : `Paid (${s.payment_method})`, s.service_type];
  });
  autoTable(doc, { startY: 26, head: [["Date", "Receipt No", "Guest/Room", "Item", "Qty", "Amount", "Payment Status", "Served By"]], body });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(10);
  doc.text(`Total Sales: ${money(total)}    Cash: ${money(cash)}    Unpaid: ${money(unpaidAmt)}`, 14, y);
  finish(doc, o.printedBy, `${fileBase(o.code)}_Restaurant_${o.range.to}.pdf`, o.mode);
}
