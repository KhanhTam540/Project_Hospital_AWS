import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import axios from "../../../api/axiosClient";
import toast from "react-hot-toast";
import {
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../../utils/apiResponse";

const emptyProfile = {
  hoTen: "",
  gioiTinh: "Nam",
  ngaySinh: "",
  diaChi: "",
  soDienThoai: "",
  bhyt: "",
  email: "",
};

const genderToDisplay = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "NU" || normalized === "NỮ") return "Nữ";
  if (normalized === "KHAC" || normalized === "KHÁC") return "Khác";
  return "Nam";
};

const parseStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const ThongTinCaNhanPage = () => {
  const [profile, setProfile] = useState(emptyProfile);
  const [initialProfile, setInitialProfile] = useState(emptyProfile);
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const storedUser = parseStoredUser();
      let backendIdentity = {};

      try {
        const identityResponse = await axios.get("/auth/me");
        backendIdentity = unwrapApiResponse(identityResponse, {}) || {};
      } catch (identityError) {
        console.warn("Không tải được /auth/me, sử dụng phiên local", identityError);
      }

      const accountId =
        backendIdentity.maTK ||
        backendIdentity.appUserId ||
        storedUser.maTK ||
        localStorage.getItem("maTK") ||
        "";

      const linkedPatientId =
        backendIdentity.maBN ||
        backendIdentity.patientId ||
        storedUser.maBN ||
        localStorage.getItem("maBN") ||
        "";

      let patientResponse = null;

      if (accountId) {
        try {
          patientResponse = await axios.get(
            `/benhnhan/findByMaTK/${encodeURIComponent(accountId)}`,
          );
        } catch (accountLookupError) {
          if (accountLookupError.response?.status !== 404) {
            throw accountLookupError;
          }
        }
      }

      if (!patientResponse && linkedPatientId) {
        patientResponse = await axios.get(
          `/benhnhan/${encodeURIComponent(linkedPatientId)}`,
        );
      }

      if (!patientResponse) {
        throw new Error(
          "Tài khoản chưa được liên kết với hồ sơ bệnh nhân. Hãy đăng xuất và đăng nhập lại.",
        );
      }

      const patient = unwrapApiResponse(patientResponse, null);
      if (!patient) {
        throw new Error("Không tìm thấy dữ liệu bệnh nhân.");
      }

      const resolvedPatientId =
        patient.maBN || patient.patientId || linkedPatientId;

      const dateValue = patient.ngaySinh || patient.dateOfBirth || "";
      const formatted = {
        hoTen: patient.hoTen || patient.fullName || "",
        gioiTinh: genderToDisplay(patient.gioiTinh || patient.gender),
        ngaySinh: dateValue && dayjs(dateValue).isValid()
          ? dayjs(dateValue).format("YYYY-MM-DD")
          : "",
        diaChi: patient.diaChi || patient.address || "",
        soDienThoai: patient.soDienThoai || patient.phoneNumber || "",
        bhyt: patient.bhyt || patient.healthInsuranceNumber || "",
        email:
          backendIdentity.email ||
          storedUser.email ||
          patient.email ||
          "",
      };

      setPatientId(resolvedPatientId || "");
      setProfile(formatted);
      setInitialProfile(formatted);
      setLastUpdated(
        patient.updatedAt || patient.ngayCapNhat || new Date().toISOString(),
      );

      const mergedUser = {
        ...storedUser,
        ...backendIdentity,
        maBN: resolvedPatientId || storedUser.maBN,
        patientId: resolvedPatientId || storedUser.patientId,
        maTK: accountId || storedUser.maTK,
        hoTen: formatted.hoTen || storedUser.hoTen,
        HoTen: formatted.hoTen || storedUser.HoTen,
        email: formatted.email || storedUser.email,
      };

      localStorage.setItem("user", JSON.stringify(mergedUser));
      if (mergedUser.maTK) localStorage.setItem("maTK", mergedUser.maTK);
      if (resolvedPatientId) localStorage.setItem("maBN", resolvedPatientId);
    } catch (requestError) {
      console.error("Không tải được thông tin bệnh nhân", requestError);
      const message = getApiErrorMessage(
        requestError,
        "Không thể tải thông tin cá nhân.",
      );
      setError(message);
      setProfile(emptyProfile);
      setInitialProfile(emptyProfile);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    dayjs.locale("vi");
    fetchProfile();
  }, [fetchProfile]);

  const hasChanges = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(initialProfile),
    [profile, initialProfile],
  );

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    if (!hasChanges || !patientId) return;

    try {
      setSaving(true);
      setError("");

      await axios.put(`/benhnhan/${encodeURIComponent(patientId)}`, {
        hoTen: profile.hoTen,
        gioiTinh: profile.gioiTinh,
        ngaySinh: profile.ngaySinh || null,
        diaChi: profile.diaChi,
        soDienThoai: profile.soDienThoai,
        bhyt: profile.bhyt,
      });

      toast.success("Cập nhật thông tin thành công!");
      await fetchProfile();
    } catch (requestError) {
      const message = getApiErrorMessage(
        requestError,
        "Không thể cập nhật thông tin cá nhân.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-600 to-indigo-700 p-8 text-white shadow-xl">
          <div className="absolute inset-y-0 right-0 w-1/3 bg-white/10 blur-3xl" />
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
              Hồ sơ cá nhân
            </p>
            <h1 className="mb-3 mt-2 text-3xl font-bold md:text-4xl">
              Thông tin bệnh nhân
            </h1>
            <p className="max-w-2xl text-white/85">
              Cập nhật chính xác thông tin liên hệ và bảo hiểm để bệnh viện hỗ trợ bạn nhanh nhất.
            </p>
            <div className="mt-4 text-sm text-white/75">
              Mã bệnh nhân: {patientId || "Chưa liên kết"}
              <span className="mx-2">•</span>
              Lần cập nhật gần nhất:{" "}
              {lastUpdated
                ? dayjs(lastUpdated).format("DD/MM/YYYY HH:mm")
                : "Chưa xác định"}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Thông tin liên hệ
              </h2>
              <p className="text-sm text-slate-500">
                Những trường có dấu * là bắt buộc để hoàn thiện hồ sơ.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchProfile}
              disabled={loading || saving}
              className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tải lại dữ liệu
            </button>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-500">
              Đang tải thông tin bệnh nhân...
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleUpdateProfile}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Họ và tên *
                  <input
                    name="hoTen"
                    value={profile.hoTen}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Số điện thoại *
                  <input
                    name="soDienThoai"
                    value={profile.soDienThoai}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Ngày sinh
                  <input
                    type="date"
                    name="ngaySinh"
                    value={profile.ngaySinh}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Giới tính
                  <select
                    name="gioiTinh"
                    value={profile.gioiTinh}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  Mã BHYT
                  <input
                    name="bhyt"
                    value={profile.bhyt}
                    onChange={handleProfileChange}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    placeholder="VD: DN-4-12-345678"
                  />
                </label>
              </div>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                Địa chỉ liên hệ
                <input
                  name="diaChi"
                  value={profile.diaChi}
                  onChange={handleProfileChange}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                />
              </label>

              <label className="space-y-1 text-sm font-medium text-slate-700">
                Email đăng nhập
                <input
                  value={profile.email}
                  disabled
                  className="w-full cursor-not-allowed rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-slate-500"
                />
                <span className="text-xs text-slate-400">
                  *Để thay đổi email, vui lòng liên hệ bộ phận hỗ trợ.
                </span>
              </label>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  Thông tin sẽ giúp bác sĩ liên hệ và xác minh bảo hiểm y tế của bạn.
                </p>
                <button
                  type="submit"
                  disabled={saving || loading || !hasChanges || !patientId}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold text-white transition ${
                    saving || loading || !hasChanges || !patientId
                      ? "cursor-not-allowed bg-slate-300"
                      : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThongTinCaNhanPage;
