import axios from "../../api/axiosClient";

export const getGioHang = (maBN) => axios.get(`/hoadon/giohang/${maBN}`);
export const addToGioHang = (data) => axios.post("/hoadon/giohang", data);
export const confirmGioHang = (data) => axios.post("/hoadon/giohang/confirm", data);
export const getMyHoaDon = (maBN) => axios.get(`/hoadon/myhoadon/${maBN}`);
export const getHoaDonById = (maHD) => axios.get(`/hoadon/${encodeURIComponent(maHD)}`);
export const getThanhToan = (maHD) => axios.get(`/hoadon/thanhtoan/${maHD}`);
export const deleteItemGioHang = (id) => axios.delete(`/hoadon/giohang/item/${id}`);
export const createThanhToan = (data) => axios.post("/hoadon/thanhtoan", data);
export const createThanhToanDemo = (data) => axios.post("/hoadon/thanhtoan", data);
export const createOnlinePaymentUrl = (data) => axios.post("/payment/create-url", data);
export const updateTrangThaiHoaDon = (maHD, data) => axios.put(`/hoadon/${maHD}`, data);
