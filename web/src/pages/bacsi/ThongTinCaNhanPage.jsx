import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  Briefcase,
  Building2,
  GraduationCap,
  Info,
  Mail,
  Stethoscope,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  getCurrentSessionProfile,
  getKhoaList,
  resolveCurrentDoctor,
} from "../../services/bacsi/bacsiService";
import { getApiErrorMessage } from "../../utils/apiResponse";

const Field = ({ icon: Icon, label, value, mono = false }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-500">
      {Icon && <Icon size={16} />}
      {label}
    </div>
    <p
      className={`break-words font-semibold text-slate-800 ${
        mono ? "font-mono text-sm" : ""
      }`}
    >
      {value || "Chưa có"}
    </p>
  </div>
);

const ThongTinCaNhanPage = () => {
  const [doctor, setDoctor] = useState(null);
  const [session, setSession] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [doctorItem, sessionItem, departmentItems] = await Promise.all([
          resolveCurrentDoctor({ forceRefresh: true }),
          getCurrentSessionProfile(),
          getKhoaList(),
        ]);

        if (!active) return;
        setDoctor(doctorItem);
        setSession(sessionItem);
        setDepartments(departmentItems);
      } catch (error) {
        if (!active) return;
        setDoctor(null);
        setSession(null);
        toast.error(
          getApiErrorMessage(error, "Không thể tải thông tin bác sĩ"),
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const departmentName = useMemo(() => {
    const departmentId =
      doctor?.maKhoa || doctor?.departmentId || session?.maKhoa;
    if (!departmentId) return "Chưa có";

    const department = departments.find(
      (item) =>
        String(item.maKhoa || item.departmentId) === String(departmentId),
    );

    return (
      department?.tenKhoa ||
      department?.departmentName ||
      doctor?.KhoaPhong?.tenKhoa ||
      departmentId
    );
  }, [departments, doctor, session]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          Đang tải thông tin bác sĩ...
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        Không tìm thấy hồ sơ bác sĩ gắn với tài khoản đang đăng nhập.
      </div>
    );
  }

  const doctorId = doctor.maBS || doctor.doctorId;
  const accountId = doctor.maTK || session?.maTK || session?.appUserId;
  const email = doctor.email || session?.email;
  const status =
    doctor.trangThai === 0 || doctor.status === "INACTIVE"
      ? "Ngừng hoạt động"
      : "Đang hoạt động";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <section className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-7 text-white shadow-lg">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20">
            <User size={44} />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-100">Hồ sơ bác sĩ</p>
            <h1 className="mt-1 text-3xl font-bold">
              {doctor.hoTen || doctor.fullName || "Bác sĩ"}
            </h1>
            <p className="mt-2 text-blue-100">
              {doctor.chuyenMon || doctor.specialty || "Chưa cập nhật chuyên môn"}
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
        <Info className="mt-0.5 shrink-0" size={19} />
        <div>
          <p className="font-semibold">Thông tin chỉ đọc</p>
          <p className="mt-1">
            Bác sĩ chỉ được xem thông tin cá nhân. Mọi thay đổi về họ tên,
            khoa, chuyên môn, chức vụ, trình độ hoặc cấp bậc phải do quản trị
            viên thực hiện tại trang quản lý bác sĩ.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xl font-bold text-slate-800">
          Thông tin chuyên môn
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            icon={User}
            label="Họ tên"
            value={doctor.hoTen || doctor.fullName}
          />
          <Field icon={Building2} label="Khoa" value={departmentName} />
          <Field
            icon={Stethoscope}
            label="Chuyên môn"
            value={doctor.chuyenMon || doctor.specialty}
          />
          <Field
            icon={Briefcase}
            label="Chức vụ"
            value={doctor.chucVu || doctor.position}
          />
          <Field
            icon={GraduationCap}
            label="Trình độ"
            value={doctor.trinhDo || doctor.degree}
          />
          <Field
            icon={Award}
            label="Cấp bậc"
            value={doctor.capBac || doctor.rank}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-xl font-bold text-slate-800">
          Thông tin tài khoản
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field icon={Mail} label="Email" value={email} />
          <Field label="Mã bác sĩ" value={doctorId} mono />
          <Field label="Mã tài khoản" value={accountId} mono />
          <Field label="Trạng thái" value={status} />
        </div>
      </section>
    </div>
  );
};

export default ThongTinCaNhanPage;
