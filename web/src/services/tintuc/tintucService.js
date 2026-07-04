import axios from "../../api/axiosClient";

// API public dùng cho trang chủ và bệnh nhân, không yêu cầu JWT.
export const getPublicTinTuc = (params = {}) =>
  axios.get("/public/tintuc", { params });
export const getPublicOneTinTuc = (maTin) =>
  axios.get(`/public/tintuc/${encodeURIComponent(maTin)}`);

// API quản trị yêu cầu tài khoản ADMIN.
export const getAllTinTuc = (params = {}) => axios.get("/tintuc", { params });
export const getOneTinTuc = (maTin) =>
  axios.get(`/tintuc/${encodeURIComponent(maTin)}`);
export const createTinTuc = (data) => axios.post("/tintuc", data);
export const updateTinTuc = (maTin, data) =>
  axios.put(`/tintuc/${encodeURIComponent(maTin)}`, data);
export const deleteTinTuc = (maTin) =>
  axios.delete(`/tintuc/${encodeURIComponent(maTin)}`);
