import axios from "../../api/axiosClient";

export const createPhanHoi = (data) => axios.post("/phanhoi", data);
export const getPhanHoiByBenhNhan = (maBN) =>
  axios.get(`/phanhoi/benhnhan/${encodeURIComponent(maBN)}`);
export const getAllPhanHoi = (params = {}) => axios.get("/phanhoi", { params });
export const getOnePhanHoi = (maPH) =>
  axios.get(`/phanhoi/${encodeURIComponent(maPH)}`);
export const updatePhanHoi = (maPH, data) =>
  axios.put(`/phanhoi/${encodeURIComponent(maPH)}`, data);
export const deletePhanHoi = (maPH) =>
  axios.delete(`/phanhoi/${encodeURIComponent(maPH)}`);
export const getPhanHoiStats = () => axios.get("/phanhoi/stats");
