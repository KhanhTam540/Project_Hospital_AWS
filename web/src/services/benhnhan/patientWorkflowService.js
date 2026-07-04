import axios from "../../api/axiosClient";
import {
  ensureArray,
  ensureObject,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const text = (value) => String(value ?? "").trim();

export const normalizePatient = (item = {}) => ({
  ...item,
  patientId: text(item.patientId || item.maBN),
  maBN: text(item.maBN || item.patientId),
  accountId: text(item.accountId || item.maTK || item.appUserId),
  maTK: text(item.maTK || item.accountId || item.appUserId),
  fullName: text(item.fullName || item.hoTen),
  hoTen: text(item.hoTen || item.fullName),
  birthDate: item.birthDate || item.ngaySinh || "",
  ngaySinh: item.ngaySinh || item.birthDate || "",
  gender: text(item.gender || item.gioiTinh),
  gioiTinh: text(item.gioiTinh || item.gender),
  address: text(item.address || item.diaChi),
  diaChi: text(item.diaChi || item.address),
  phoneNumber: text(item.phoneNumber || item.soDienThoai),
  soDienThoai: text(item.soDienThoai || item.phoneNumber),
  healthInsurance: text(
    item.healthInsurance || item.healthInsuranceNumber || item.bhyt,
  ),
  bhyt: text(
    item.bhyt || item.healthInsurance || item.healthInsuranceNumber,
  ),
  citizenId: text(item.citizenId || item.cccd),
  cccd: text(item.cccd || item.citizenId),
  email: text(item.email),
});

const savePatientSession = (identity, patient) => {
  const previous = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const merged = {
    ...previous,
    ...identity,
    maBN: patient.patientId,
    patientId: patient.patientId,
    maTK: identity.maTK || identity.appUserId || previous.maTK,
    hoTen: patient.fullName,
    fullName: patient.fullName,
    cccd: patient.citizenId,
  };

  localStorage.setItem("user", JSON.stringify(merged));
  localStorage.setItem("maBN", patient.patientId);
  if (merged.maTK) localStorage.setItem("maTK", merged.maTK);
};

export async function getCurrentPatientProfile() {
  const identityResponse = await axios.get("/auth/me");
  const identity = ensureObject(unwrapApiResponse(identityResponse, {}));

  let patientId = text(identity.patientId || identity.maBN);
  let patient = null;

  if (!patientId) {
    const accountId = text(identity.appUserId || identity.maTK || identity.sub);
    if (accountId) {
      try {
        const byAccountResponse = await axios.get(
          `/benhnhan/findByMaTK/${encodeURIComponent(accountId)}`,
        );
        patient = normalizePatient(
          unwrapApiResponse(byAccountResponse, {}),
        );
        patientId = patient.patientId;
      } catch (error) {
        if (error?.response?.status !== 404) throw error;
      }
    }
  }

  if (!patientId) {
    throw new Error(
      "Tài khoản chưa được liên kết với hồ sơ bệnh nhân. Vui lòng đăng xuất và đăng nhập lại.",
    );
  }

  if (!patient) {
    const patientResponse = await axios.get(
      `/benhnhan/${encodeURIComponent(patientId)}`,
    );
    patient = normalizePatient(unwrapApiResponse(patientResponse, {}));
  }

  if (!patient.patientId) {
    throw new Error("Không tìm thấy hồ sơ bệnh nhân đang đăng nhập");
  }

  savePatientSession(identity, patient);
  return { identity, patient };
}

export async function updateCurrentPatientProfile(patientId, payload) {
  const response = await axios.put(
    `/benhnhan/${encodeURIComponent(patientId)}`,
    {
      hoTen: text(payload.hoTen || payload.fullName),
      ngaySinh: payload.ngaySinh || payload.birthDate || null,
      gioiTinh: text(payload.gioiTinh || payload.gender),
      diaChi: text(payload.diaChi || payload.address),
      soDienThoai: text(payload.soDienThoai || payload.phoneNumber),
      bhyt: text(payload.bhyt || payload.healthInsurance),
      cccd: text(payload.cccd || payload.citizenId),
    },
  );
  return normalizePatient(unwrapApiResponse(response, {}));
}

export async function getPatientAppointments(patientId) {
  const response = await axios.get(
    `/lichkham/benhnhan/${encodeURIComponent(patientId)}`,
  );
  return ensureArray(unwrapApiResponse(response, []));
}

export async function getBookingDepartments() {
  const response = await axios.get("/khoa");
  return ensureArray(unwrapApiResponse(response, [])).filter(
    (item) => item.trangThai !== 0 && item.status !== "INACTIVE",
  );
}

export async function getBookingDoctors() {
  const response = await axios.get("/bacsi");
  return ensureArray(unwrapApiResponse(response, [])).filter(
    (item) => item.trangThai !== 0 && item.status !== "INACTIVE",
  );
}

export async function createPatientAppointment(patientId, payload) {
  const response = await axios.post("/lichkham", {
    maBN: patientId,
    patientId,
    maKhoa: text(payload.maKhoa || payload.departmentId),
    departmentId: text(payload.maKhoa || payload.departmentId),
    maBS: text(payload.maBS || payload.doctorId) || null,
    doctorId: text(payload.maBS || payload.doctorId) || null,
    ngayKham: payload.ngayKham || payload.appointmentDate,
    appointmentDate: payload.ngayKham || payload.appointmentDate,
    gioKham: payload.gioKham || payload.appointmentTime,
    appointmentTime: payload.gioKham || payload.appointmentTime,
    ghiChu: text(payload.ghiChu || payload.note),
    note: text(payload.ghiChu || payload.note),
    phong: "",
  });
  return unwrapApiResponse(response, {});
}

export async function checkDoctorAppointmentSlot({
  doctorId,
  appointmentDate,
  appointmentTime,
}) {
  if (!doctorId) return { trung: false };
  const response = await axios.get("/lichkham/check", {
    params: {
      maBS: doctorId,
      ngay: appointmentDate,
      gio: appointmentTime,
    },
  });
  return unwrapApiResponse(response, response?.data || { trung: false });
}
