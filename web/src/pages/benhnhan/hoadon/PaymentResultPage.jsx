import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const PaymentResultPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // 'success' | 'fail'
  const [message, setMessage] = useState("Đang xử lý kết quả...");

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = () => {
    // 1. Kiểm tra tham số status từ backend redirect (VNPAY/MOMO)
    const statusParam = searchParams.get("status");
    if (statusParam) {
      if (statusParam === "success") {
        setStatus("success");
        const maHD = searchParams.get("maHD");
        setMessage(maHD ? `Giao dịch thanh toán thành công! Mã hóa đơn: ${maHD}` : "Giao dịch thanh toán thành công!");
        // Tự động redirect sau 3 giây nếu thành công
        setTimeout(() => {
          const token = localStorage.getItem("token");
          if (token) {
            navigate(`/patient/hoadon?reload=true&maHD=${maHD || ''}`);
          } else {
            navigate("/login");
          }
        }, 3000);
      } else {
        setStatus("fail");
        const messageParam = searchParams.get("message");
        setMessage(messageParam ? decodeURIComponent(messageParam) : "Thanh toán thất bại");
      }
      return;
    }

    // 2. Kiểm tra kết quả VNPAY (trường hợp redirect trực tiếp từ VNPAY)
    const vnpCode = searchParams.get("vnp_ResponseCode");
    if (vnpCode) {
      if (vnpCode === "00") {
        setStatus("success");
        setMessage("Giao dịch VNPAY thành công!");
        // Tự động redirect sau 3 giây
        setTimeout(() => {
          const token = localStorage.getItem("token");
          if (token) {
            navigate("/patient/hoadon?reload=true");
          } else {
            navigate("/login");
          }
        }, 3000);
      } else {
        setStatus("fail");
        setMessage(`Giao dịch VNPAY thất bại (Lỗi: ${vnpCode})`);
      }
      return;
    }

    // 3. Kiểm tra kết quả MOMO (trường hợp redirect trực tiếp từ MOMO)
    const momoCode = searchParams.get("resultCode");
    if (momoCode) {
      if (momoCode === "0") {
        setStatus("success");
        setMessage("Giao dịch MoMo thành công!");
        // Tự động redirect sau 3 giây
        setTimeout(() => {
          const token = localStorage.getItem("token");
          if (token) {
            navigate("/patient/hoadon?reload=true");
          } else {
            navigate("/login");
          }
        }, 3000);
      } else {
        setStatus("fail");
        setMessage(`Giao dịch MoMo thất bại (Lỗi: ${momoCode})`);
      }
      return;
    }
    
    // Không tìm thấy tham số
    setStatus("error");
    setMessage("Không tìm thấy thông tin giao dịch.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        
        {/* ICON TRẠNG THÁI */}
        <div className="flex justify-center mb-6">
          {status === "success" ? (
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

        {/* TIÊU ĐỀ & NỘI DUNG */}
        <h2 className={`text-2xl font-bold mb-2 ${status === "success" ? "text-green-700" : "text-red-700"}`}>
          {status === "success" ? "Thanh toán thành công!" : "Thanh toán thất bại"}
        </h2>
        <p className="text-gray-600 mb-8">{message}</p>

        {/* NÚT ĐIỀU HƯỚNG */}
        <div className="space-y-3">
          <button
            onClick={() => {
              const maHD = searchParams.get("maHD");
              const token = localStorage.getItem("token");
              // Nếu có token, redirect về trang hóa đơn, nếu không thì về trang chủ
              if (token) {
                navigate(`/patient/hoadon?reload=true${maHD ? `&maHD=${maHD}` : ''}`);
              } else {
                navigate("/login");
              }
            }}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            📜 Xem lại hóa đơn
          </button>
          <button
            onClick={() => {
              const token = localStorage.getItem("token");
              if (token) {
                navigate("/patient");
              } else {
                navigate("/login");
              }
            }}
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