import axios from "../../api/axiosClient";

const unwrap = (response, fallback = null) => {
  const body = response?.data;
  if (body && typeof body === "object" && "data" in body) {
    return body.data ?? fallback;
  }
  return body ?? fallback;
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.records)) return value.records;
  return [];
};

const safeText = (value) => String(value ?? "").trim();
const sameId = (left, right) =>
  safeText(left).toUpperCase() === safeText(right).toUpperCase();

const uniqueBy = (items, selector) => {
  const result = new Map();
  for (const item of items || []) {
    const key = safeText(selector(item)).toUpperCase();
    if (!key) continue;
    if (!result.has(key)) result.set(key, item);
  }
  return [...result.values()];
};

export const normalizeMedicalRecord = (item = {}) => {
  const patient = item.BenhNhan || item.patient || null;
  const recordId = safeText(
    item.recordId || item.medicalRecordId || item.maHSBA,
  );
  const patientId = safeText(item.patientId || item.maBN);
  const displayRecordId = safeText(
    item.displayRecordId ||
      item.maHSBAHienThi ||
      item.recordCode ||
      patient?.cccd ||
      patient?.citizenId ||
      item.cccd ||
      recordId,
  );
  const citizenId = safeText(
    item.cccd || item.citizenId || patient?.cccd || patient?.citizenId,
  );

  return {
    ...item,
    recordId,
    medicalRecordId: recordId,
    maHSBA: recordId,
    displayRecordId,
    maHSBAHienThi: displayRecordId,
    citizenId,
    cccd: citizenId,
    patientId,
    maBN: patientId,
    patientName: safeText(
      item.patientName ||
        patient?.hoTen ||
        patient?.fullName ||
        item.hoTenBenhNhan,
    ),
    diagnosis: safeText(item.diagnosis || item.chuanDoan),
    medicalHistory: safeText(item.medicalHistory || item.lichSuBenh),
    note: safeText(item.note || item.ghiChu),
    status: safeText(item.status || item.trangThai || "OPEN"),
    createdAt: item.createdAt || item.ngayLap || null,
  };
};

export const normalizeExamination = (item = {}) => {
  const examinationId = safeText(item.examinationId || item.maPK);
  const recordId = safeText(
    item.recordId || item.medicalRecordId || item.maHSBA,
  );
  const patientId = safeText(item.patientId || item.maBN);

  return {
    ...item,
    examinationId,
    maPK: examinationId,
    recordId,
    medicalRecordId: recordId,
    maHSBA: recordId,
    patientId,
    maBN: patientId,
    symptoms: safeText(item.symptoms || item.trieuChung),
    diagnosis: safeText(item.diagnosis || item.chuanDoan),
    treatment: safeText(item.treatment || item.dieuTri),
    advice: safeText(item.advice || item.loiDan),
    status: safeText(item.status || item.trangThai),
    vitals: item.vitals || item.sinhHieu || {},
    createdAt: item.createdAt || item.ngayKham || null,
  };
};

export const normalizePrescription = (item = {}) => {
  const prescriptionId = safeText(item.prescriptionId || item.maDT);
  const examinationId = safeText(item.examinationId || item.maPK);
  const recordId = safeText(
    item.recordId || item.medicalRecordId || item.maHSBA,
  );
  const patientId = safeText(item.patientId || item.maBN);

  return {
    ...item,
    prescriptionId,
    maDT: prescriptionId,
    examinationId,
    maPK: examinationId,
    recordId,
    medicalRecordId: recordId,
    maHSBA: recordId,
    patientId,
    maBN: patientId,
    medicineItems: Array.isArray(item.medicineItems)
      ? item.medicineItems
      : Array.isArray(item.chiTiet)
        ? item.chiTiet
        : [],
    generalInstructions: safeText(
      item.generalInstructions || item.loiDan,
    ),
    status: safeText(item.status || item.trangThai),
    createdAt: item.createdAt || item.ngayKeDon || null,
  };
};

export const normalizeLabRequest = (item = {}) => {
  const labRequestId = safeText(item.labRequestId || item.maYeuCau);
  const recordId = safeText(
    item.recordId || item.medicalRecordId || item.maHSBA,
  );
  const patientId = safeText(item.patientId || item.maBN);
  const labTestId = safeText(item.labTestId || item.maXN);

  return {
    ...item,
    labRequestId,
    maYeuCau: labRequestId,
    recordId,
    medicalRecordId: recordId,
    maHSBA: recordId,
    patientId,
    maBN: patientId,
    labTestId,
    maXN: labTestId,
    status: safeText(item.status || item.trangThai),
    note: safeText(item.note || item.ghiChu),
    requestedAt: item.requestedAt || item.ngayYeuCau || null,
  };
};

export async function getDoctorMedicalRecords() {
  const response = await axios.get("/hsba");
  const records = toArray(unwrap(response, []))
    .map(normalizeMedicalRecord)
    .filter((item) => item.recordId && item.patientId);

  return uniqueBy(records, (item) => item.recordId).sort((left, right) =>
    String(right.createdAt || "").localeCompare(
      String(left.createdAt || ""),
    ),
  );
}

export async function getPatientExaminations(
  patientId,
  { recordId } = {},
) {
  if (!patientId) return [];

  const response = await axios.get(
    `/patients/${encodeURIComponent(patientId)}/examinations`,
    {
      params: recordId
        ? {
            medicalRecordId: recordId,
            recordId,
            maHSBA: recordId,
          }
        : undefined,
    },
  );

  return uniqueBy(
    toArray(unwrap(response, [])).map(normalizeExamination),
    (item) => item.examinationId,
  );
}

export async function getExaminationsByRecord(record) {
  const normalizedRecord = normalizeMedicalRecord(record);
  if (!normalizedRecord.patientId || !normalizedRecord.recordId) return [];

  const examinations = await getPatientExaminations(
    normalizedRecord.patientId,
    { recordId: normalizedRecord.recordId },
  );

  return examinations
    .filter((item) => {
      const itemRecordId = safeText(item.recordId);
      return !itemRecordId || sameId(itemRecordId, normalizedRecord.recordId);
    })
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(
        String(left.createdAt || ""),
      ),
    );
}

export async function createExaminationForRecord(record, payload) {
  const normalizedRecord = normalizeMedicalRecord(record);
  if (!normalizedRecord.patientId || !normalizedRecord.recordId) {
    throw new Error("Hồ sơ bệnh án không có mã bệnh nhân hoặc mã hồ sơ");
  }

  const symptoms = safeText(payload?.symptoms || payload?.trieuChung);
  const diagnosis = safeText(payload?.diagnosis || payload?.chuanDoan);
  if (!symptoms || !diagnosis) {
    throw new Error("Triệu chứng và chẩn đoán là bắt buộc");
  }

  const response = await axios.post(
    `/patients/${encodeURIComponent(normalizedRecord.patientId)}/examinations`,
    {
      medicalRecordId: normalizedRecord.recordId,
      recordId: normalizedRecord.recordId,
      maHSBA: normalizedRecord.recordId,
      symptoms,
      diagnosis,
      treatment: safeText(payload?.treatment || payload?.dieuTri),
      advice: safeText(payload?.advice || payload?.loiDan),
      vitals: payload?.vitals || {},
    },
  );

  return normalizeExamination(unwrap(response, {}));
}

export async function getPatientPrescriptions(
  patientId,
  { recordId, examinationId } = {},
) {
  if (!patientId) return [];

  const response = await axios.get(
    `/patients/${encodeURIComponent(patientId)}/prescriptions`,
    {
      params: {
        ...(recordId
          ? {
              medicalRecordId: recordId,
              recordId,
              maHSBA: recordId,
            }
          : {}),
        ...(examinationId
          ? { examinationId, maPK: examinationId }
          : {}),
      },
    },
  );

  return uniqueBy(
    toArray(unwrap(response, [])).map(normalizePrescription),
    (item) => item.prescriptionId,
  );
}

export async function getPrescriptionsByRecord(record) {
  const normalizedRecord = normalizeMedicalRecord(record);
  if (!normalizedRecord.patientId || !normalizedRecord.recordId) return [];

  const items = await getPatientPrescriptions(normalizedRecord.patientId, {
    recordId: normalizedRecord.recordId,
  });

  return items
    .filter((item) => sameId(item.recordId, normalizedRecord.recordId))
    .sort((left, right) =>
      String(right.createdAt || "").localeCompare(
        String(left.createdAt || ""),
      ),
    );
}

export async function createPrescriptionForExamination({
  record,
  examination,
  medicineItems,
  generalInstructions,
}) {
  const normalizedRecord = normalizeMedicalRecord(record);
  const normalizedExamination = normalizeExamination(examination);

  if (!normalizedRecord.patientId || !normalizedRecord.recordId) {
    throw new Error("Hồ sơ bệnh án không hợp lệ");
  }
  if (!normalizedExamination.examinationId) {
    throw new Error("Phiếu khám không hợp lệ");
  }
  if (!Array.isArray(medicineItems) || medicineItems.length === 0) {
    throw new Error("Đơn thuốc phải có ít nhất một thuốc");
  }

  const response = await axios.post(
    `/patients/${encodeURIComponent(normalizedRecord.patientId)}/prescriptions`,
    {
      recordId: normalizedRecord.recordId,
      medicalRecordId: normalizedRecord.recordId,
      maHSBA: normalizedRecord.recordId,
      examinationId: normalizedExamination.examinationId,
      maPK: normalizedExamination.examinationId,
      medicineItems,
      generalInstructions: safeText(generalInstructions),
    },
  );

  return normalizePrescription(unwrap(response, {}));
}

export async function getMedicines() {
  const response = await axios.get("/thuoc");
  return uniqueBy(
    toArray(unwrap(response, [])).map((item) => {
      const medicineId = safeText(item.medicineId || item.maThuoc);
      const medicineName = safeText(item.medicineName || item.tenThuoc);
      return {
        ...item,
        medicineId,
        maThuoc: medicineId,
        medicineName,
        tenThuoc: medicineName,
      };
    }),
    (item) => item.medicineId,
  );
}

export async function getLabTests() {
  const response = await axios.get("/xetnghiem");
  return uniqueBy(
    toArray(unwrap(response, [])).map((item) => {
      const labTestId = safeText(item.labTestId || item.maXN || item.testId);
      const testName = safeText(item.testName || item.tenXN || item.labTestName);
      return {
        ...item,
        labTestId,
        maXN: labTestId,
        testName,
        tenXN: testName,
      };
    }),
    (item) => item.labTestId,
  );
}

export async function getLabRequests(params = {}) {
  const response = await axios.get("/yeucauxetnghiem", { params });
  return uniqueBy(
    toArray(unwrap(response, [])).map(normalizeLabRequest),
    (item) => item.labRequestId,
  );
}

export async function getLabRequestsByRecord(record) {
  const normalizedRecord = normalizeMedicalRecord(record);
  if (!normalizedRecord.recordId) return [];

  const items = await getLabRequests({
    medicalRecordId: normalizedRecord.recordId,
    maHSBA: normalizedRecord.recordId,
  });

  return items.filter((item) =>
    sameId(item.recordId, normalizedRecord.recordId),
  );
}

export async function createLabRequestForRecord({
  record,
  labTestId,
  priority,
  note,
}) {
  const normalizedRecord = normalizeMedicalRecord(record);
  const normalizedLabTestId = safeText(labTestId);

  if (!normalizedRecord.patientId || !normalizedRecord.recordId) {
    throw new Error("Hồ sơ bệnh án không hợp lệ");
  }
  if (!normalizedLabTestId) {
    throw new Error("Vui lòng chọn xét nghiệm");
  }

  const response = await axios.post("/yeucauxetnghiem", {
    patientId: normalizedRecord.patientId,
    maBN: normalizedRecord.patientId,
    medicalRecordId: normalizedRecord.recordId,
    recordId: normalizedRecord.recordId,
    maHSBA: normalizedRecord.recordId,
    labTestId: normalizedLabTestId,
    maXN: normalizedLabTestId,
    priority: safeText(priority || "NORMAL").toUpperCase(),
    note: safeText(note),
    ghiChu: safeText(note),
  });

  return normalizeLabRequest(unwrap(response, {}));
}

export async function getDepartments() {
  const response = await axios.get("/khoa");
  return toArray(unwrap(response, []));
}
