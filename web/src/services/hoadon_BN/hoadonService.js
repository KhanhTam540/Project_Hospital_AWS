import axios from "../../api/axiosClient";

export const getGioHang = (maBN) => axios.get(`/hoadon/giohang/${maBN}`);
export const addToGioHang = (data) => axios.post("/hoadon/giohang", data);
export const confirmGioHang = (data) => axios.post("/hoadon/giohang/confirm", data);
export const getMyHoaDon = (maBN) => axios.get(`/hoadon/myhoadon/${maBN}`);
export const getHoaDonById = (maHD) => axios.get(`/hoadon/${encodeURIComponent(maHD)}`);
export const getThanhToan = (maHD) => axios.get(`/hoadon/thanhtoan/${maHD}`);
export const deleteItemGioHang = (id) => axios.delete(`/hoadon/giohang/item/${id}`);

// Giữ lại API này cho thu ngân/admin nếu project cần ghi nhận tiền mặt nội bộ.
// Trang bệnh nhân không còn dùng thanh toán demo nữa.
export const createThanhToan = (data) => axios.post("/hoadon/thanhtoan", data);

export const createOnlinePaymentUrl = (data) => axios.post("/payment/create-url", data);

export const createVnpayPayment = ({ maHD, invoiceId, bankCode, locale = "vn" }) =>
  axios.post("/payment/create-url", {
    maHD: maHD || invoiceId,
    invoiceId: invoiceId || maHD,
    provider: "VNPAY",
    phuongThuc: "VNPAY",
    bankCode,
    locale,
  });

export const updateTrangThaiHoaDon = (maHD, data) => axios.put(`/hoadon/${maHD}`, data);
