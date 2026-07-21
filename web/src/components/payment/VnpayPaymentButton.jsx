import React, { useState } from "react";
import {
  createVnpayPayment,
  redirectToVnpayCheckout,
} from "../../services/payment/vnpayPaymentService";

function pickInvoiceId(invoice) {
  return invoice?.invoiceId || invoice?.maHD || invoice?.billId || invoice?.id;
}

function getPaymentStatus(invoice) {
  return String(
    invoice?.paymentStatus ||
      invoice?.trangThaiThanhToan ||
      invoice?.status ||
      invoice?.trangThai ||
      ""
  ).toUpperCase();
}

function isPaid(invoice) {
  return ["PAID", "DA_THANH_TOAN", "DATHANHTOAN", "COMPLETED", "SUCCESS"].includes(
    getPaymentStatus(invoice)
  );
}

export default function VnpayPaymentButton({
  invoice,
  invoiceId,
  className = "btn btn-primary",
  children = "Thanh toán VNPay",
  onBeforeRedirect,
  onPaid,
}) {
  const [loading, setLoading] = useState(false);

  const resolvedInvoiceId = invoiceId || pickInvoiceId(invoice);
  const disabled = loading || !resolvedInvoiceId || isPaid(invoice);

  async function handleClick() {
    if (!resolvedInvoiceId) {
      alert("Không xác định được mã hóa đơn.");
      return;
    }

    if (isPaid(invoice)) {
      alert("Hóa đơn này đã được thanh toán.");
      onPaid?.();
      return;
    }

    try {
      setLoading(true);
      const result = await createVnpayPayment(resolvedInvoiceId, { locale: "vn" });

      if (result?.paid || result?.status === "PAID") {
        alert("Hóa đơn này đã được thanh toán.");
        onPaid?.(result);
        return;
      }

      onBeforeRedirect?.(result);

      if (!redirectToVnpayCheckout(result)) {
        alert(result?.message || "Không tạo được URL thanh toán VNPay.");
      }
    } catch (error) {
      alert(error.message || "Lỗi tạo thanh toán VNPay.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" className={className} disabled={disabled} onClick={handleClick}>
      {loading ? "Đang tạo thanh toán..." : children}
    </button>
  );
}
