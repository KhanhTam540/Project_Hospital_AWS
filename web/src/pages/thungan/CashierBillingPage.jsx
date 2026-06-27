import React, { useState } from "react";
import toast from "react-hot-toast";
import { Banknote, Clock, Receipt, Wallet } from "lucide-react";
import { MOCK_PENDING_BILLS, PAYMENT_STATUS } from "../../data/mockBillingData";
import { calculateBilling, formatVND } from "../../utils/billingCalculations";
import PendingPaymentsTable from "../../components/billing/PendingPaymentsTable";
import BillingDetailModal from "../../components/billing/BillingDetailModal";

const CashierBillingPage = () => {
  const [bills, setBills] = useState(MOCK_PENDING_BILLS);
  const [selectedBill, setSelectedBill] = useState(null);
  const [statusFilter, setStatusFilter] = useState(PAYMENT_STATUS.PENDING);

  const pendingBills = bills.filter((b) => b.trangThai === PAYMENT_STATUS.PENDING);
  const pendingTotal = pendingBills.reduce(
    (s, b) => s + calculateBilling(b).finalTotal,
    0
  );

  const handleProcessPayment = (maHD) => {
    setBills((prev) =>
      prev.map((b) =>
        b.maHD === maHD
          ? { ...b, trangThai: PAYMENT_STATUS.PAID, paidAt: new Date().toISOString() }
          : b
      )
    );
    setSelectedBill((prev) =>
      prev?.maHD === maHD
        ? { ...prev, trangThai: PAYMENT_STATUS.PAID, paidAt: new Date().toISOString() }
        : prev
    );
    toast.success(`Đã xử lý thanh toán ${maHD} (mock)`);
  };

  const stats = [
    {
      label: "Chờ thanh toán",
      value: pendingBills.length,
      sub: formatVND(pendingTotal),
      icon: Clock,
      color: "from-amber-500 to-orange-500",
    },
    {
      label: "Đã thu hôm nay",
      value: bills.filter((b) => b.trangThai === PAYMENT_STATUS.PAID).length,
      sub: "Mock data",
      icon: Wallet,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "Tổng hóa đơn",
      value: bills.length,
      sub: "Trong hệ thống",
      icon: Receipt,
      color: "from-blue-500 to-indigo-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg">
          <Banknote size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quầy thu ngân — Billing</h1>
          <p className="text-sm text-gray-500">
            Danh sách viện phí chưa thanh toán · Mock data (THUNGAN)
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm"
          >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${s.color} text-white shadow`}>
              <s.icon size={22} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <PendingPaymentsTable
        bills={bills}
        onViewBill={setSelectedBill}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {selectedBill && (
        <BillingDetailModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onProcessPayment={handleProcessPayment}
        />
      )}
    </div>
  );
};

export default CashierBillingPage;
