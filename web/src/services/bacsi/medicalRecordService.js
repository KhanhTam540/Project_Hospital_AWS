import axios from "../../api/axiosClient";

const unwrapList = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export const getAllMedicalRecords = async () => {
  const response = await axios.get("/hsba");
  return unwrapList(response);
};

export const getMedicalRecord = async (recordId) => {
  const response = await axios.get(`/hsba/${encodeURIComponent(recordId)}`);
  return response?.data?.data ?? response?.data ?? null;
};

export const normalizeMedicalRecord = (record = {}) => ({
  ...record,
  recordId: record.recordId || record.maHSBA || "",
  maHSBA: record.maHSBA || record.recordId || "",
  patientId: record.patientId || record.maBN || "",
  maBN: record.maBN || record.patientId || "",
  patientName:
    record.BenhNhan?.hoTen ||
    record.benhNhan?.hoTen ||
    record.patientName ||
    record.hoTenBN ||
    record.maBN ||
    record.patientId ||
    "Bệnh nhân",
});

export const getNormalizedMedicalRecords = async () =>
  (await getAllMedicalRecords())
    .map(normalizeMedicalRecord)
    .filter((record) => record.recordId && record.patientId);
