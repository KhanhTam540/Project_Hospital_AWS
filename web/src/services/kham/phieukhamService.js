import {
  createExaminationForRecord,
  getDoctorMedicalRecords,
  getExaminationsByRecord,
  getPatientExaminations,
} from "../bacsi/doctorWorkflowService";

export const getHoSoBenhAnChoBacSi = getDoctorMedicalRecords;
export const getPhieuKhamTheoHoSo = getExaminationsByRecord;
export const getPhieuKhamTheoBenhNhan = getPatientExaminations;
export const createPhieuKhamTheoHoSo = createExaminationForRecord;
