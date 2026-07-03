import React, { useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import { PAYMENT_STATUS } from "../../data/mockBillingData";
import { calculateBilling, formatVND } from "../../utils/billingCalculations";
import PaymentStatusBadge from "./PaymentStatusBadge";

const PendingPaymentsTable = ({ bills, onViewBill, statusFilter, onStatusFilterChange }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = [...bills];

    if (statusFilter !== "ALL") {
      list = list.filter((b) => b.trangThai === statusFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.hoTenBN.toLowerCase().includes(q) ||
          b.maBN.toLowerCase().includes(q) ||
          b.maHD.toLowerCase().includes(q) ||
          b.sdt.includes(q)
      );
    }

    return list.sort(
      (a, b) => new Date(b.ngayLap).getTime() - new Date(a.ngayLap).getTime()
    );
  }, [bills, search, statusFilter]);

  const pendingCount = bills.filter((b) => b.trangThai === PAYMENT_STATUS.PENDING).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mã BN, mã HĐ, SĐT…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
          />
        </div>
        <div className="flex gap-2">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: PAYMENT_STATUS.PENDING, label: `Pending (${pendingCount})` },
            { id: PAYMENT_STATUS.PAID, label: "Paid" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onStatusFilterChange(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === f.id
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Mã HĐ</th>
              <th className="text-left px-4 py-3">Bệnh nhân</th>
              <th className="text-left px-4 py-3 hidden md:table-cell">Khoa / BS</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Ngày lập</th>
              <th className="text-right px-4 py-3">Tổng tiền</th>
              <th className="text-center px-4 py-3">Trạng thái</th>
              <th className="text-center px-4 py-3 w-20">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Không tìm thấy hóa đơn phù hợp
                </td>
              </tr>
            ) : (
              filtered.map((bill) => {
                const { finalTotal } = calculateBilling(bill);
                return (
                  <tr
                    key={bill.maHD}
                    className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                    onClick={() => onViewBill(bill)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{bill.maHD}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{bill.hoTenBN}</p>
                      <p className="text-xs text-gray-500">{bill.maBN} · {bill.sdt}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                      {bill.khoa}
                      <br />
                      <span className="text-gray-400">{bill.bacSi}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-xs">
                      {new Date(bill.ngayLap).toLocaleString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">
                      {formatVND(finalTotal)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <PaymentStatusBadge status={bill.trangThai} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewBill(bill);
                        }}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
        Hiển thị {filtered.length} / {bills.length} hóa đơn
      </div>
    </div>
  );
};

export default PendingPaymentsTable;
