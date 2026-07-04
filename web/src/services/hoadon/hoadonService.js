import axios from "../../api/axiosClient";

export const getHoaDonList = () => axios.get("/hoadon");
export const getHoaDonById = (maHD) => axios.get(`/hoadon/${maHD}`);
export const createHoaDon = (data) => axios.post("/hoadon", data);
export const updateHoaDon = (maHD, data) => axios.put(`/hoadon/${maHD}`, data);
export const addChiTietHD = (data) => axios.post("/hoadon/chitiet", data);

export const getGioHang = (maBN) => axios.get(`/hoadon/giohang/${maBN}`);
export const addToGioHang = (data) => axios.post("/hoadon/giohang", data);
export const confirmGioHang = (data) => axios.post("/hoadon/giohang/confirm", data);
export const getMyHoaDon = (maBN) => axios.get(`/hoadon/myhoadon/${maBN}`);
export const getThanhToan = (maHD) => axios.get(`/hoadon/thanhtoan/${maHD}`);
export const deleteItemGioHang = (id) => axios.delete(`/hoadon/giohang/item/${id}`);
export const createThanhToan = (data) => axios.post("/hoadon/thanhtoan", data);
export const updateTrangThaiHoaDon = (maHD, data) => axios.put(`/hoadon/${maHD}`, data);
