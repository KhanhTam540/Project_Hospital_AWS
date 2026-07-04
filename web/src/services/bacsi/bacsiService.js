import axios from "../../api/axiosClient";

const unwrap = (response, fallback = null) => {
  const body = response?.data;
  if (body && typeof body === "object" && "data" in body) {
    return body.data ?? fallback;
  }
  return body ?? fallback;
};

const cleanStoredValue = (value) => {
  const normalized = String(value ?? "").trim();
  if (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return "";
  }
  return normalized;
};

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const saveResolvedDoctor = (doctor, sessionProfile = null) => {
  const doctorId = cleanStoredValue(doctor?.maBS || doctor?.doctorId);
  if (!doctorId) return doctor;

  localStorage.setItem("maBS", doctorId);

  const storedUser = readStoredUser();
  const nextUser = {
    ...storedUser,
    ...(sessionProfile || {}),
    maBS: doctorId,
    doctorId,
  };

  localStorage.setItem("user", JSON.stringify(nextUser));
  return doctor;
};

export async function getCurrentSessionProfile() {
  const response = await axios.get("/me");
  return unwrap(response, {});
}

export async function getBacSiByTK(maTK) {
  const accountId = cleanStoredValue(maTK);
  if (!accountId) {
    throw new Error("Mã tài khoản bác sĩ không hợp lệ");
  }

  try {
    const response = await axios.get(
      `/bacsi/maTK/${encodeURIComponent(accountId)}`,
    );
    return unwrap(response);
  } catch (error) {
    if (error?.response?.status !== 404) throw error;

    const response = await axios.get(
      `/bacsi/tk/${encodeURIComponent(accountId)}`,
    );
    return unwrap(response);
  }
}

export async function getBacSiById(maBS) {
  const doctorId = cleanStoredValue(maBS);
  if (!doctorId) {
    throw new Error("Mã bác sĩ không hợp lệ");
  }

  const response = await axios.get(
    `/bacsi/${encodeURIComponent(doctorId)}`,
  );
  return unwrap(response);
}

/**
 * Lấy hồ sơ bác sĩ hiện tại từ JWT qua /api/me.
 * localStorage chỉ là cache, không còn là nguồn xác định danh tính chính.
 */
export async function resolveCurrentDoctor({ forceRefresh = false } = {}) {
  const storedUser = readStoredUser();

  if (!forceRefresh) {
    const cachedDoctorId = cleanStoredValue(
      localStorage.getItem("maBS") ||
        storedUser.maBS ||
        storedUser.doctorId,
    );

    if (cachedDoctorId) {
      try {
        const doctor = await getBacSiById(cachedDoctorId);
        if (doctor?.maBS || doctor?.doctorId) {
          return saveResolvedDoctor(doctor);
        }
      } catch (error) {
        if (error?.response?.status !== 404) {
          console.warn("Không thể kiểm tra maBS đã lưu:", error);
        }
      }
    }
  }

  const sessionProfile = await getCurrentSessionProfile();
  const resolvedDoctorId = cleanStoredValue(
    sessionProfile.maBS || sessionProfile.doctorId,
  );

  if (resolvedDoctorId) {
    const doctor = await getBacSiById(resolvedDoctorId);
    return saveResolvedDoctor(doctor, sessionProfile);
  }

  const accountCandidates = [
    sessionProfile.maTK,
    sessionProfile.appUserId,
    localStorage.getItem("maTK"),
    storedUser.maTK,
    storedUser.appUserId,
    storedUser.userId,
    sessionProfile.sub,
    storedUser.sub,
  ]
    .map(cleanStoredValue)
    .filter(Boolean);

  let lastError = null;
  for (const accountId of [...new Set(accountCandidates)]) {
    try {
      const doctor = await getBacSiByTK(accountId);
      if (doctor?.maBS || doctor?.doctorId) {
        return saveResolvedDoctor(doctor, sessionProfile);
      }
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) throw error;
    }
  }

  throw (
    lastError ||
    new Error("Tài khoản hiện tại chưa được liên kết với hồ sơ bác sĩ")
  );
}

export async function getKhoaList() {
  const response = await axios.get("/khoa");
  const data = unwrap(response, []);
  return Array.isArray(data) ? data : [];
}

export const getDepartments = getKhoaList;
