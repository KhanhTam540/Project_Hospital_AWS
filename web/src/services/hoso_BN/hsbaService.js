import axios from "../../api/axiosClient";

const unwrapData = (response) => response?.data?.data ?? response?.data ?? null;

export const getHoSoByBenhNhan = (maBN) =>
  axios.get(`/hsba/benhnhan/${encodeURIComponent(maBN)}`);

export const getHoSoTongHop = (maBN) =>
  axios.get(`/hsba/benhnhan/${encodeURIComponent(maBN)}/tong-hop`);

export const getChiTietHoSo = (maHSBA) =>
  axios.get(`/hsba/${encodeURIComponent(maHSBA)}`);

export const getBenhNhanByTaiKhoan = (maTK) =>
  axios.get(`/benhnhan/findByMaTK/${encodeURIComponent(maTK)}`);

export const resolvePatientId = async () => {
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const directPatientId =
    localStorage.getItem("maBN") ||
    storedUser.maBN ||
    storedUser.patientId ||
    null;

  if (directPatientId) return directPatientId;

  const accountId =
    localStorage.getItem("maTK") ||
    storedUser.maTK ||
    storedUser.userId ||
    storedUser.username ||
    null;

  if (!accountId) return null;

  const response = await getBenhNhanByTaiKhoan(accountId);
  const patient = unwrapData(response);
  const patientId = patient?.maBN || patient?.patientId || null;

  if (patientId) {
    localStorage.setItem("maBN", patientId);
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...storedUser,
        maBN: patientId,
        patientId,
      }),
    );
  }

  return patientId;
};

export const verifyChain = (maHSBA, ngayKiemTra) =>
  axios.get(`/hsba/verify/${encodeURIComponent(maHSBA)}`, {
    params: {
      ngay: ngayKiemTra,
    },
  });
