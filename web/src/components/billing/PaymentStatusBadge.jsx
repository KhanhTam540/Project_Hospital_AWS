import React from "react";
import { PAYMENT_STATUS } from "../../data/mockBillingData";

const styles = {
  [PAYMENT_STATUS.PENDING]: "bg-amber-100 text-amber-800 border-amber-200",
  [PAYMENT_STATUS.PAID]: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const labels = {
  [PAYMENT_STATUS.PENDING]: "Pending",
  [PAYMENT_STATUS.PAID]: "Paid",
};

const PaymentStatusBadge = ({ status }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
      styles[status] || "bg-gray-100 text-gray-600 border-gray-200"
    }`}
  >
    {labels[status] || status}
  </span>
);

export default PaymentStatusBadge;
