import React, { useEffect, useMemo, useState } from "react";
import { getPaymentStatus } from "../../services/payment/vnpayPaymentService";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });
}

function isPaidStatus(value) {
  return ["PAID", "DA_THANH_TOAN", "DATHANHTOAN", "COMPLETED", "SUCCESS"].includes(
    String(value || "").toUpperCase()
  );
}

export default function VnpayReturnPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  const query = useMemo(() => new URLSearchParams(window.location.search), []);

  const txnRef = query.get("vnp_TxnRef") || "";
  const responseCode = query.get("vnp_ResponseCode") || "";
  const transactionStatus = query.get("vnp_TransactionStatus") || "";
  const transactionNo = query.get("vnp_TransactionNo") || "";
  const amount = Number(query.get("vnp_Amount") || 0) / 100;

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        if (!txnRef) {
          throw new Error("Thiếu mã giao dịch VNPay trên đường dẫn trả về.");
        }

        const result = await getPaymentStatus({ txnRef });
        if (!cancelled) setStatus(result);
      } catch (err) {
        if (!cancelled) setError(err.message || "Không kiểm tra được trạng thái thanh toán.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [txnRef]);

  const vnpayReturnSuccess = responseCode === "00" && transactionStatus === "00";
  const backendPaid = isPaidStatus(status?.paymentStatus) || isPaidStatus(status?.invoiceStatus);

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-3">
      <div className="card border-0 shadow-sm" style={{ maxWidth: 760, width: "100%" }}>
        <div className="card-body p-4 p-md-5">
          <div className="d-flex align-items-start justify-content-between gap-3 mb-4">
            <div>
              <h1 className="h3 mb-2">Kết quả thanh toán VNPay</h1>
              <p className="text-muted mb-0">
                Hệ thống kiểm tra kết quả từ VNPay và trạng thái hóa đơn trong bệnh viện.
              </p>
            </div>
            <span className="badge text-bg-primary">VNPay</span>
          </div>

          {loading && (
            <div className="alert alert-info mb-4">
              Đang kiểm tra kết quả thanh toán, vui lòng đợi vài giây...
            </div>
          )}

          {!loading && error && (
            <div className="alert alert-danger mb-4">
              <strong>Không kiểm tra được trạng thái thanh toán.</strong>
              <div>{error}</div>
            </div>
          )}

          {!loading && !error && (
            <>
              {vnpayReturnSuccess && backendPaid ? (
                <div className="alert alert-success mb-4">
                  <strong>Thanh toán thành công.</strong>
                  <div>Hóa đơn của bạn đã được hệ thống ghi nhận là đã thanh toán.</div>
                </div>
              ) : vnpayReturnSuccess && !backendPaid ? (
                <div className="alert alert-warning mb-4">
                  <strong>VNPay báo giao dịch thành công.</strong>
                  <div>
                    Backend đang chờ IPN xác nhận để cập nhật hóa đơn. Hãy quay lại trang hóa đơn
                    và tải lại sau vài giây.
                  </div>
                </div>
              ) : (
                <div className="alert alert-danger mb-4">
                  <strong>Thanh toán chưa thành công.</strong>
                  <div>Mã phản hồi VNPay: {responseCode || "Không có"}</div>
                </div>
              )}

              <div className="border rounded-3 p-3 bg-white">
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="text-muted small">Mã giao dịch hệ thống</div>
                    <div className="fw-semibold text-break">{txnRef || "Không có"}</div>
                  </div>
                  <div className="col-md-6">
                    <div className="text-muted small">Mã giao dịch VNPay</div>
                    <div className="fw-semibold text-break">
                      {transactionNo || status?.providerTransactionNo || "Không có"}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="text-muted small">Số tiền</div>
                    <div className="fw-semibold">{formatCurrency(amount || status?.amountVnd)}</div>
                  </div>
                  <div className="col-md-6">
                    <div className="text-muted small">Trạng thái hóa đơn</div>
                    <div className="fw-semibold">{status?.invoiceStatus || "UNKNOWN"}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="d-flex flex-wrap gap-2 mt-4">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                window.location.href = "/benhnhan/hoadon";
              }}
            >
              Quay lại hóa đơn
            </button>
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Về trang chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
