import {
  createPrescriptionForExamination,
  getExaminationsByRecord,
  getMedicines,
  getPrescriptionsByRecord,
} from "../bacsi/doctorWorkflowService";

export const getDanhSachThuoc = getMedicines;
export const getPhieuKhamTheoHoSo = getExaminationsByRecord;
export const getDonThuocTheoHoSo = getPrescriptionsByRecord;
export const createDonThuocTheoPhieuKham =
  createPrescriptionForExamination;
