/**
 * Mock billing calculation helpers (no API).
 */

export const lineTotal = (item) => item.donGia * item.soLuong;

export const calculateBilling = (bill) => {
  const items = bill.items || [];

  const lineItems = items.map((item) => {
    const thanhTien = lineTotal(item);
    const bhytEligible = bill.coBaoHiem && item.bhytEligible;
    const mucBHYT =
      bhytEligible && bill.tyLeBHYT
        ? Math.round(thanhTien * (bill.tyLeBHYT / 100))
        : 0;
    const benhNhanTra = thanhTien - mucBHYT;

    return {
      ...item,
      thanhTien,
      bhytEligible: Boolean(bhytEligible),
      mucBHYT,
      benhNhanTra,
    };
  });

  const subtotal = lineItems.reduce((s, i) => s + i.thanhTien, 0);
  const insuranceDeduction = lineItems.reduce((s, i) => s + i.mucBHYT, 0);
  const finalTotal = subtotal - insuranceDeduction;

  const byCategory = lineItems.reduce((acc, item) => {
    const cat = item.category || "OTHER";
    acc[cat] = (acc[cat] || 0) + item.thanhTien;
    return acc;
  }, {});

  return {
    lineItems,
    subtotal,
    insuranceDeduction,
    finalTotal,
    byCategory,
    coBaoHiem: Boolean(bill.coBaoHiem),
    tyLeBHYT: bill.tyLeBHYT || 0,
  };
};

export const formatVND = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

export const numberToWordsVND = (num) => {
  if (num === 0) return "Không đồng";
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const readTriple = (n) => {
    const tr = Math.floor(n / 100);
    const ch = Math.floor((n % 100) / 10);
    const dv = n % 10;
    let s = "";
    if (tr) s += `${units[tr]} trăm `;
    if (ch === 1) s += "mười ";
    else if (ch) s += `${units[ch]} mươi `;
    if (dv) s += units[dv];
    return s.trim();
  };
  const billion = Math.floor(num / 1_000_000_000);
  const million = Math.floor((num % 1_000_000_000) / 1_000_000);
  const thousand = Math.floor((num % 1_000_000) / 1000);
  const rest = num % 1000;
  const parts = [];
  if (billion) parts.push(`${readTriple(billion)} tỷ`);
  if (million) parts.push(`${readTriple(million)} triệu`);
  if (thousand) parts.push(`${readTriple(thousand)} nghìn`);
  if (rest) parts.push(readTriple(rest));
  return `${parts.join(" ").replace(/\s+/g, " ").trim()} đồng`;
};
