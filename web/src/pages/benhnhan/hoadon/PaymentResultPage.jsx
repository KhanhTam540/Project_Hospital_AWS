import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const PaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  const result = useMemo(() => {
    const statusParam = searchParams.get("status");
    const maHD = searchParams.get("maHD") || "";
    const responseCode = searchParams.get("vnp_ResponseCode");
    const transactionStatus = searchParams.get("vnp_TransactionStatus");
    const transactionNo = searchParams.get("vnp_TransactionNo");
    const txnRef = searchParams.get("vnp_TxnRef");
    const rawMessage = searchParams.get("message") || "";
    const message = rawMessage ? decodeURIComponent(rawMessage) : "";

    const successByStatus = statusParam === "success";
    const successByVnpay = responseCode === "00" && transactionStatus === "00";
    const failedByStatus = statusParam === "fail";

    if (successByStatus || successByVnpay) {
      return {
        type: "success",
        title: "VNPay đã ghi nhận giao dịch",
        message:
          message ||
          "Giao dịch VNPay trả về thành công. Hệ thống sẽ cập nhật hóa đơn sau khi IPN từ VNPay được xác minh ở backend.",
        maHD,
        txnRef,
        transactionNo,
        responseCode,
        transactionStatus,
      };
    }

    if (failedByStatus || responseCode) {
      return {
        type: "fail",
        title: "Thanh toán chưa thành công",
        message:
          message ||
          `VNPay trả về mã phản hồi ${responseCode || "không xác định"}. Hóa đơn chưa được chuyển sang đã thanh toán.`,
        maHD,
        txnRef,
        transactionNo,
        responseCode,
        transactionStatus,
      };
    }

    return {
      type: "error",
      title: "Không tìm thấy thông tin giao dịch",
      message: "Trang kết quả không nhận được tham số thanh toán hợp lệ từ VNPay.",
      maHD,
      txnRef,
      transactionNo,
      responseCode,
      transactionStatus,
    };
  }, [searchParams]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      if (token) {
        navigate(`/patient/hoadon?reload=true${result.maHD ? `&maHD=${result.maHD}` : ""}`);
      } else {
        navigate("/login");
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate, result.maHD]);

  const isSuccess = result.type === "success";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-xl w-full text-center">
        <div className="flex justify-center mb-6">
          {isSuccess ? (
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        <h2 className={`text-2xl font-bold mb-2 ${isSuccess ? "text-green-700" : "text-red-700"}`}>
          {result.title}
        </h2>
        <p className="text-gray-600 mb-6 leading-relaxed">{result.message}</p>

        {isSuccess && (
          <div className="text-left bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 mb-6 text-sm leading-relaxed">
            <strong>Lưu ý:</strong> Trang này chỉ là kết quả trả về cho người dùng. Hóa đơn chỉ được cập nhật là đã thanh toán khi backend nhận và xác minh IPN hợp lệ từ VNPay.
          </div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm mb-6 space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Mã hóa đơn</span>
            <strong>{result.maHD || "Không có"}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Mã yêu cầu</span>
            <strong className="break-all text-right">{result.txnRef || "Không có"}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Mã giao dịch VNPay</span>
            <strong className="break-all text-right">{result.transactionNo || "Chưa có"}</strong>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Mã phản hồi</span>
            <strong>{result.responseCode || "Không có"}</strong>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Tự động quay lại trang hóa đơn sau {countdown} giây.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => {
              const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
              if (token) {
                navigate(`/patient/hoadon?reload=true${result.maHD ? `&maHD=${result.maHD}` : ""}`);
              } else {
                navigate("/login");
              }
            }}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            📜 Xem lại hóa đơn
          </button>
          <button
            onClick={() => navigate("/")}
            className="w-full py-3 px-4 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            🏠 Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentResultPage;
