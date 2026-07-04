import axios from "../../api/axiosClient";
import {
  createLabRequestForRecord,
  getDoctorMedicalRecords,
  getLabRequests,
  getLabRequestsByRecord,
  getLabTests,
} from "../bacsi/doctorWorkflowService";

export const getHoSoBenhAnChoBacSi = getDoctorMedicalRecords;
export const getDanhMucXetNghiem = getLabTests;
export const getAllYeuCau = getLabRequests;
export const getYeuCauTheoHoSo = getLabRequestsByRecord;
export const createYeuCauTheoHoSo = createLabRequestForRecord;

export const updateTrangThai = (id, data) =>
  axios.put(`/yeucauxetnghiem/${encodeURIComponent(id)}`, data);

export const deleteYeuCau = (id) =>
  axios.delete(`/yeucauxetnghiem/${encodeURIComponent(id)}`);
