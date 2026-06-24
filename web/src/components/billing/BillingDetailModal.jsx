import React, { useMemo } from "react";
import { CreditCard, Printer, Shield, X } from "lucide-react";
import { ITEM_CATEGORIES, PAYMENT_STATUS } from "../../data/mockBillingData";
import { calculateBilling, formatVND } from "../../utils/billingCalculations";
import PaymentStatusBadge from "./PaymentStatusBadge";
import EInvoicePrint from "./EInvoicePrint";

const CategoryGroup = ({ category, items }) => {
  const meta = ITEM_CATEGORIES[category] || ITEM_CATEGORIES.OTHER;
  const groupTotal = items.reduce((s, i) => s + i.thanhTien, 0);

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
          {meta.label}
        </span>
        <span className="text-xs text-gray-500">{formatVND(groupTotal)}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">Dịch vụ / Thuốc</th>
              <th className="text-center px-3 py-2 w-16">SL</th>
              <th className="text-right px-3 py-2 w-28">Đơn giá</th>
              <th className="text-right px-3 py-2 w-28">Thành tiền</th>
              <th className="text-center px-3 py-2 w-20">BHYT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="px-3 py-2 text-gray-800">{item.ten}</td>
                <td className="px-3 py-2 text-center text-gray-600">{item.soLuong}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatVND(item.donGia)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatVND(item.thanhTien)}</td>
                <td className="px-3 py-2 text-center">
                  {item.bhytEligible ? (
                    <span className="text-emerald-600 text-xs">✓</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BillingDetailModal = ({ bill, onClose, onProcessPayment }) => {
  const calc = useMemo(() => (bill ? calculateBilling(bill) : null), [bill]);

  if (!bill || !calc) return null;

  const grouped = calc.lineItems.reduce((acc, item) => {
    const cat = item.category || "OTHER";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = ["CONSULTATION", "LAB", "PHARMACY", "OTHER"];
  const isPending = bill.trangThai === PAYMENT_STATUS.PENDING;

  const handlePrint = () => {
    if (isPending && onProcessPayment) {
      onProcessPayment(bill.maHD);
    }
    setTimeout(() => window.print(), 300);
  };

  return (
    <>
      {/* Screen modal */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm print:hidden"
        onClick={onClose}
      >
        <div
          className="bg-white w-full sm:max-w-3xl max-h-[92vh] sm:rounded-xl shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-emerald-50 to-teal-50">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gray-800">Chi tiết hóa đơn</h2>
                <PaymentStatusBadge status={bill.trangThai} />
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {bill.maHD} · {bill.hoTenBN} ({bill.maBN})
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 text-xs">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Bác sĩ</p>
                <p className="font-medium text-gray-800 mt-0.5">{bill.bacSi}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Khoa</p>
                <p className="font-medium text-gray-800 mt-0.5">{bill.khoa}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Ngày lập</p>
                <p className="font-medium text-gray-800 mt-0.5">
                  {new Date(bill.ngayLap).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500">Bảo hiểm</p>
                <p className="font-medium text-gray-800 mt-0.5 flex items-center gap-1">
                  {bill.coBaoHiem ? (
                    <>
                      <Shield size={12} className="text-emerald-600" />
                      {bill.tyLeBHYT}%
                    </>
                  ) : (
                    "Không"
                  )}
                </p>
              </div>
            </div>

            {categoryOrder.map(
              (cat) =>
                grouped[cat]?.length > 0 && (
                  <CategoryGroup key={cat} category={cat} items={grouped[cat]} />
                )
            )}

            {/* Calculation summary */}
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Tính toán thanh toán</h4>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tạm tính (Subtotal)</span>
                <span className="font-medium">{formatVND(calc.subtotal)}</span>
              </div>
              {calc.coBaoHiem && (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Giảm trừ BHYT ({calc.tyLeBHYT}% trên dịch vụ được chi trả)</span>
                  <span className="font-medium">-{formatVND(calc.insuranceDeduction)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-300 pt-3 mt-2">
                <span className="text-gray-800">Tổng thanh toán (Final Total)</span>
                <span className="text-emerald-700">{formatVND(calc.finalTotal)}</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Đóng
            </button>
            {isPending ? (
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm"
              >
                <CreditCard size={16} />
                <Printer size={16} />
                Process Payment & Print
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
              >
                <Printer size={16} />
                In lại hóa đơn
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Print-only invoice (rendered in DOM for window.print) */}
      <EInvoicePrint bill={bill} paidAt={bill.paidAt || new Date().toISOString()} />
    </>
  );
};

export default BillingDetailModal;
