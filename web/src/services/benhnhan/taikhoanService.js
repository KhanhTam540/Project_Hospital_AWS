import axios from "../../api/axiosClient";
import {
  getCurrentPatientProfile,
  updateCurrentPatientProfile,
} from "./patientWorkflowService";

export const getTaiKhoanById = (id) => axios.get(`/taikhoan/${id}`);
export const getAllBenhNhan = () => axios.get("/benhnhan");
export const updateBenhNhan = (id, data) =>
  updateCurrentPatientProfile(id, data);
export const getBenhNhanByMaTK = (maTK) =>
  axios.get(`/benhnhan/findByMaTK/${encodeURIComponent(maTK)}`);
export const getThongTinBenhNhanHienTai = getCurrentPatientProfile;
