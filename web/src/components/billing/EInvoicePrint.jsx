import React from "react";
import { HOSPITAL_INVOICE_INFO, ITEM_CATEGORIES } from "../../data/mockBillingData";
import { calculateBilling, formatVND, numberToWordsVND } from "../../utils/billingCalculations";

const EInvoicePrint = ({ bill, paidAt, cashierName = "Thu ngân" }) => {
  if (!bill) return null;

  const calc = calculateBilling(bill);
  const paidDate = paidAt ? new Date(paidAt) : new Date();

  const formatDate = (iso) =>
    new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="e-invoice-print hidden print:block bg-white text-black p-0 m-0">
      <div className="max-w-[210mm] mx-auto p-8 font-sans text-sm leading-relaxed">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">
            {HOSPITAL_INVOICE_INFO.tenBenhVien}
          </h1>
          <p className="text-xs text-gray-600 mt-1">{HOSPITAL_INVOICE_INFO.diaChi}</p>
          <p className="text-xs text-gray-600">
            MST: {HOSPITAL_INVOICE_INFO.maSoThue} · ĐT: {HOSPITAL_INVOICE_INFO.dienThoai}
          </p>
          <h2 className="text-lg font-bold mt-4 uppercase text-blue-900">
            Hóa đơn điện tử (E-Invoice)
          </h2>
          <p className="text-xs text-gray-500">Mẫu số: 01GTKT0/001 · Ký hiệu: SM/26E</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div>
            <p>
              <strong>Số HĐ:</strong> {bill.maHD}
            </p>
            <p>
              <strong>Ngày lập:</strong> {formatDate(bill.ngayLap)}
            </p>
            <p>
              <strong>Ngày thanh toán:</strong> {formatDate(paidDate)}
            </p>
          </div>
          <div className="text-right">
            <p>
              <strong>Mã BN:</strong> {bill.maBN}
            </p>
            <p>
              <strong>Bác sĩ:</strong> {bill.bacSi}
            </p>
            <p>
              <strong>Khoa:</strong> {bill.khoa}
            </p>
          </div>
        </div>

        {/* Buyer */}
        <div className="border border-gray-300 rounded p-3 mb-6 text-xs">
          <p className="font-bold mb-1">Người mua / Bệnh nhân</p>
          <p>
            <strong>Họ tên:</strong> {bill.hoTenBN}
          </p>
          <p>
            <strong>Giới tính:</strong> {bill.gioiTinh} · <strong>ĐT:</strong> {bill.sdt}
          </p>
          {bill.coBaoHiem && (
            <p>
              <strong>BHYT:</strong> {bill.maBHYT} (chi trả {bill.tyLeBHYT}%)
            </p>
          )}
        </div>

        {/* Line items */}
        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left w-8">STT</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Nội dung</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center w-16">SL</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Đơn giá</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {calc.lineItems.map((item, idx) => (
              <tr key={item.id}>
                <td className="border border-gray-300 px-2 py-1 text-center">{idx + 1}</td>
                <td className="border border-gray-300 px-2 py-1">
                  {item.ten}
                  <span className="text-gray-500 ml-1">
                    ({ITEM_CATEGORIES[item.category]?.label || item.category})
                  </span>
                </td>
                <td className="border border-gray-300 px-2 py-1 text-center">{item.soLuong}</td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {formatVND(item.donGia)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right font-medium">
                  {formatVND(item.thanhTien)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 text-xs space-y-1">
            <div className="flex justify-between">
              <span>Tạm tính (Subtotal):</span>
              <span>{formatVND(calc.subtotal)}</span>
            </div>
            {calc.coBaoHiem && (
              <div className="flex justify-between text-emerald-700">
                <span>BHYT chi trả ({calc.tyLeBHYT}%):</span>
                <span>-{formatVND(calc.insuranceDeduction)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-400 pt-2 mt-2">
              <span>Tổng thanh toán:</span>
              <span>{formatVND(calc.finalTotal)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs italic mb-8">
          <strong>Bằng chữ:</strong> {numberToWordsVND(calc.finalTotal)}
        </p>

        {/* Signatures */}
        <div className="grid grid-cols-3 gap-4 text-center text-xs mt-12">
          <div>
            <p className="font-semibold mb-12">Người mua hàng</p>
            <p className="italic text-gray-500">(Ký, ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="font-semibold mb-12">Thu ngân</p>
            <p>{cashierName}</p>
          </div>
          <div>
            <p className="font-semibold mb-12">Kế toán trưởng</p>
            <p className="italic text-gray-500">(Ký, đóng dấu)</p>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-8 border-t pt-4">
          Hóa đơn điện tử được lập và lưu trữ theo quy định · SmartHospital Billing System
        </p>
      </div>
    </div>
  );
};

export default EInvoicePrint;
