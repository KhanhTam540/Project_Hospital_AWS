import axios from "../../api/axiosClient";

export const getMedicalLedger = (recordId) =>
  axios.get(`/medical-records/${encodeURIComponent(recordId)}/audit`);

export const verifyMedicalLedger = (recordId) =>
  axios.get(`/medical-records/${encodeURIComponent(recordId)}/integrity`);
