import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import toast from "react-hot-toast";

import {
  getCurrentPatientProfile,
  updateCurrentPatientProfile,
} from "../../../services/benhnhan/patientWorkflowService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const EMPTY_PROFILE = {
  hoTen: "",
  gioiTinh: "Nam",
  ngaySinh: "",
  diaChi: "",
  soDienThoai: "",
  bhyt: "",
  cccd: "",
  email: "",
};

const normalizeGender = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (["NU", "NỮ", "FEMALE"].includes(normalized)) return "Nữ";
  if (["KHAC", "KHÁC"].includes(normalized)) return "Khác";
  return "Nam";
};

const toForm = (patient, identity = {}) => ({
  hoTen: patient.hoTen || patient.fullName || "",
  gioiTinh: normalizeGender(patient.gioiTinh || patient.gender),
  ngaySinh:
    patient.ngaySinh && dayjs(patient.ngaySinh).isValid()
      ? dayjs(patient.ngaySinh).format("YYYY-MM-DD")
      : "",
  diaChi: patient.diaChi || patient.address || "",
  soDienThoai: patient.soDienThoai || patient.phoneNumber || "",
  bhyt: patient.bhyt || patient.healthInsurance || "",
  cccd: patient.cccd || patient.citizenId || "",
  email: identity.email || patient.email || "",
});

const ThongTinCaNhanPage = () => {
  const [patientId, setPatientId] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [initialProfile, setInitialProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  dayjs.locale("vi");

  const hasChanges = useMemo(
    () => JSON.stringify(profile) !== JSON.stringify(initialProfile),
    [profile, initialProfile],
  );

  const citizenIdAlreadySaved = Boolean(initialProfile.cccd);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { identity, patient } = await getCurrentPatientProfile();
      const form = toForm(patient, identity);
      setPatientId(patient.patientId);
      setProfile(form);
      setInitialProfile(form);
      setLastUpdated(patient.updatedAt || new Date().toISOString());
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể tải thông tin cá nhân"),
      );
      setProfile(EMPTY_PROFILE);
      setInitialProfile(EMPTY_PROFILE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!patientId) {
      toast.error("Không xác định được hồ sơ bệnh nhân");
      return;
    }
    if (!profile.hoTen.trim() || !profile.soDienThoai.trim()) {
      toast.error("Họ tên và số điện thoại là bắt buộc");
      return;
    }
    if (!/^\d{12}$/.test(profile.cccd.trim())) {
      toast.error("CCCD phải gồm đúng 12 chữ số");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCurrentPatientProfile(patientId, profile);
      const next = toForm(updated, { email: profile.email });
      setProfile(next);
      setInitialProfile(next);
      setLastUpdated(updated.updatedAt || new Date().toISOString());
      toast.success("Cập nhật thông tin cá nhân thành công");
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể cập nhật thông tin cá nhân"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-500">
        Đang tải thông tin bệnh nhân...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-7">
        <section className="rounded-3xl bg-gradient-to-r from-sky-600 to-indigo-700 p-8 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Hồ sơ cá nhân
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">
            Thông tin bệnh nhân
          </h1>
          <p className="mt-3 max-w-2xl text-white/85">
            Bệnh nhân được phép tự cập nhật thông tin liên hệ, bảo hiểm và
            nhập CCCD. Số CCCD được dùng làm mã hồ sơ bệnh án khi hồ sơ được tạo.
          </p>
          <div className="mt-4 text-sm text-white/75">
            Mã bệnh nhân: {patientId || "Chưa liên kết"}
            <span className="mx-2">•</span>
            Cập nhật gần nhất:{" "}
            {lastUpdated
              ? dayjs(lastUpdated).format("DD/MM/YYYY HH:mm")
              : "Chưa xác định"}
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md"
        >
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Thông tin cá nhân
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Email được quản lý bởi tài khoản đăng nhập và không thay đổi tại đây.
              </p>
            </div>
            <button
              type="button"
              onClick={loadProfile}
              disabled={saving}
              className="text-sm font-semibold text-sky-700 hover:underline disabled:opacity-50"
            >
              Tải lại
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Họ và tên *
              <input
                name="hoTen"
                value={profile.hoTen}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Số điện thoại *
              <input
                name="soDienThoai"
                value={profile.soDienThoai}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              CCCD *
              <input
                name="cccd"
                inputMode="numeric"
                maxLength={12}
                value={profile.cccd}
                onChange={handleChange}
                readOnly={citizenIdAlreadySaved}
                required
                placeholder="Nhập đúng 12 chữ số"
                className={`w-full rounded-2xl border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
                  citizenIdAlreadySaved
                    ? "border-slate-200 bg-slate-100 text-slate-600"
                    : "border-slate-200"
                }`}
              />
              <span className="block text-xs font-normal text-slate-500">
                {citizenIdAlreadySaved
                  ? "CCCD đã xác nhận. Quản trị viên phải xử lý nếu cần hiệu chỉnh."
                  : "CCCD được dùng làm mã hồ sơ bệnh án và chỉ được nhập một lần."}
              </span>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Email
              <input
                value={profile.email}
                readOnly
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Ngày sinh
              <input
                type="date"
                name="ngaySinh"
                value={profile.ngaySinh}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Giới tính
              <select
                name="gioiTinh"
                value={profile.gioiTinh}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Địa chỉ
              <input
                name="diaChi"
                value={profile.diaChi}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Mã bảo hiểm y tế
              <input
                name="bhyt"
                value={profile.bhyt}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={!hasChanges || saving}
              className="rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ThongTinCaNhanPage;
