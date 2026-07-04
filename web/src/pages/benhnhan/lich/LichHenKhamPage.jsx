import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import {
  checkDoctorAppointmentSlot,
  createPatientAppointment,
  getBookingDepartments,
  getBookingDoctors,
  getCurrentPatientProfile,
  getPatientAppointments,
} from "../../../services/lichkham/lichkhamService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const HOUR_OPTIONS = ["07", "08", "09", "10", "11", "13", "14", "15", "16", "17"];
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

const EMPTY_FORM = {
  maKhoa: "",
  maBS: "",
  ngayKham: "",
  gioKhamGio: "08",
  gioKhamPhut: "00",
  ghiChu: "",
  maGioiThieu: "",
};

const statusConfig = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "CHO_THANH_TOAN":
      return {
        label: "Chờ thanh toán",
        className: "bg-amber-100 text-amber-700",
      };
    case "DA_THANH_TOAN":
    case "DA_XAC_NHAN":
      return {
        label: "Đã xác nhận",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "DA_KHAM":
      return {
        label: "Đã khám",
        className: "bg-blue-100 text-blue-700",
      };
    case "DA_HUY":
      return {
        label: "Đã hủy",
        className: "bg-rose-100 text-rose-700",
      };
    default:
      return {
        label: status || "Đang xử lý",
        className: "bg-slate-100 text-slate-700",
      };
  }
};

const LichHenKhamPage = () => {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  dayjs.locale("vi");

  const filteredDoctors = useMemo(
    () =>
      doctors.filter(
        (doctor) => !form.maKhoa || doctor.maKhoa === form.maKhoa,
      ),
    [doctors, form.maKhoa],
  );

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        const leftDate = new Date(
          `${left.ngayKham || left.appointmentDate}T${
            left.gioKham || left.appointmentTime || "00:00"
          }`,
        );
        const rightDate = new Date(
          `${right.ngayKham || right.appointmentDate}T${
            right.gioKham || right.appointmentTime || "00:00"
          }`,
        );
        return leftDate - rightDate;
      }),
    [appointments],
  );

  const upcomingCount = useMemo(() => {
    const now = new Date();
    return appointments.filter((item) => {
      const date = new Date(
        `${item.ngayKham || item.appointmentDate}T${
          item.gioKham || item.appointmentTime || "00:00"
        }`,
      );
      return date >= now && item.trangThai !== "DA_HUY";
    }).length;
  }, [appointments]);

  const loadAppointments = async (patientId) => {
    if (!patientId) return;
    const items = await getPatientAppointments(patientId);
    setAppointments(items);
  };

  const loadPage = async () => {
    setLoading(true);
    try {
      const [{ patient: currentPatient }, departmentItems, doctorItems] =
        await Promise.all([
          getCurrentPatientProfile(),
          getBookingDepartments(),
          getBookingDoctors(),
        ]);

      setPatient(currentPatient);
      setDepartments(departmentItems);
      setDoctors(doctorItems);
      await loadAppointments(currentPatient.patientId);
    } catch (error) {
      const message = getApiErrorMessage(
        error,
        "Không thể tải dữ liệu đặt lịch khám",
      );
      toast.error(message);
      if (error?.response?.status === 401) navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "maKhoa") {
      setForm((current) => ({
        ...current,
        maKhoa: value,
        maBS:
          doctors.find((doctor) => doctor.maBS === current.maBS)?.maKhoa ===
          value
            ? current.maBS
            : "",
      }));
      return;
    }

    if (name === "maGioiThieu") {
      const code = value.trim().toUpperCase();
      const doctor = doctors.find(
        (item) => String(item.maBS || "").toUpperCase() === code,
      );
      setForm((current) => ({
        ...current,
        maGioiThieu: value,
        maBS: doctor?.maBS || current.maBS,
        maKhoa: doctor?.maKhoa || current.maKhoa,
      }));
      return;
    }

    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!patient?.patientId) {
      toast.error("Không xác định được hồ sơ bệnh nhân đang đăng nhập");
      return;
    }
    if (!form.maKhoa || !form.ngayKham) {
      toast.error("Vui lòng chọn khoa và ngày khám");
      return;
    }

    const appointmentTime = `${form.gioKhamGio}:${form.gioKhamPhut}`;
    const appointmentDateTime = dayjs(
      `${form.ngayKham}T${appointmentTime}`,
    );
    if (!appointmentDateTime.isValid() || !appointmentDateTime.isAfter(dayjs())) {
      toast.error("Ngày và giờ khám phải ở tương lai");
      return;
    }

    setSubmitting(true);
    try {
      if (form.maBS) {
        const slot = await checkDoctorAppointmentSlot({
          doctorId: form.maBS,
          appointmentDate: form.ngayKham,
          appointmentTime,
        });
        if (slot?.trung) {
          toast.error("Khung giờ này đã có bệnh nhân đặt");
          return;
        }
      }

      const note = [
        form.ghiChu.trim(),
        form.maGioiThieu.trim()
          ? `[GT: ${form.maGioiThieu.trim().toUpperCase()}]`
          : "",
      ]
        .filter(Boolean)
        .join(" ");

      const created = await createPatientAppointment(patient.patientId, {
        maKhoa: form.maKhoa,
        maBS: form.maBS,
        ngayKham: form.ngayKham,
        gioKham: appointmentTime,
        ghiChu: note,
      });

      toast.success("Đặt lịch khám thành công");
      setForm(EMPTY_FORM);
      await loadAppointments(patient.patientId);

      if (created?.maHD) {
        const shouldPay = window.confirm(
          "Lịch khám đã được tạo và cần thanh toán. Chuyển đến hóa đơn ngay?",
        );
        if (shouldPay) navigate(`/patient/hoadon?maHD=${created.maHD}`);
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể đặt lịch. Vui lòng chọn thời gian khác hoặc thử lại.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-500">
        Đang tải dữ liệu đặt lịch...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-7">
        <section className="rounded-3xl bg-gradient-to-r from-sky-600 to-indigo-700 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
                Bệnh nhân đặt lịch
              </p>
              <h1 className="mt-2 text-3xl font-bold md:text-4xl">
                Đặt lịch khám bệnh
              </h1>
              <p className="mt-3 max-w-2xl text-white/85">
                Hệ thống tự lấy đúng mã bệnh nhân từ tài khoản đăng nhập. Bạn
                có thể chọn bác sĩ hoặc để bệnh viện tự phân công bác sĩ còn
                lịch trống.
              </p>
              <p className="mt-3 text-sm text-white/75">
                Bệnh nhân: {patient?.fullName || patient?.patientId}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-6 text-center backdrop-blur">
              <p className="text-sm text-white/75">Lịch sắp tới</p>
              <p className="text-4xl font-bold">{upcomingCount}</p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleCreate}
          className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Thông tin cuộc hẹn
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bác sĩ là tùy chọn. Để trống để hệ thống tự phân công.
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting ? "Đang đặt lịch..." : "Đặt lịch"}
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Khoa khám *
              <select
                name="maKhoa"
                value={form.maKhoa}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">-- Chọn khoa --</option>
                {departments.map((item) => (
                  <option key={item.maKhoa} value={item.maKhoa}>
                    {item.tenKhoa}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Bác sĩ
              <select
                name="maBS"
                value={form.maBS}
                onChange={handleChange}
                disabled={!form.maKhoa}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
              >
                <option value="">-- Tự động phân công --</option>
                {filteredDoctors.map((doctor) => (
                  <option key={doctor.maBS} value={doctor.maBS}>
                    {doctor.hoTen} - {doctor.chuyenMon || doctor.maBS}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Ngày khám *
              <input
                type="date"
                name="ngayKham"
                min={dayjs().format("YYYY-MM-DD")}
                value={form.ngayKham}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>

            <div className="space-y-1 text-sm font-medium text-slate-700">
              Giờ khám *
              <div className="grid grid-cols-2 gap-2">
                <select
                  name="gioKhamGio"
                  value={form.gioKhamGio}
                  onChange={handleChange}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour} giờ
                    </option>
                  ))}
                </select>
                <select
                  name="gioKhamPhut"
                  value={form.gioKhamPhut}
                  onChange={handleChange}
                  className="rounded-xl border border-slate-200 px-3 py-2.5"
                >
                  {MINUTE_OPTIONS.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute} phút
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Mã giới thiệu bác sĩ
              <input
                name="maGioiThieu"
                value={form.maGioiThieu}
                onChange={handleChange}
                placeholder="Ví dụ: BS001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2">
              Triệu chứng / ghi chú
              <textarea
                name="ghiChu"
                value={form.ghiChu}
                onChange={handleChange}
                rows={4}
                placeholder="Mô tả triệu chứng, dị ứng thuốc hoặc yêu cầu đặc biệt..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
          </div>
        </form>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Lịch khám của bạn
              </h2>
              <p className="text-sm text-slate-500">
                Tổng cộng {appointments.length} lịch khám.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadAppointments(patient.patientId)}
              className="text-sm font-semibold text-sky-700 hover:underline"
            >
              Tải lại
            </button>
          </div>

          {sortedAppointments.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 py-10 text-center text-slate-500">
              Chưa có lịch khám nào.
            </p>
          ) : (
            <div className="space-y-3">
              {sortedAppointments.map((item) => {
                const status = statusConfig(item.trangThai || item.status);
                const date = item.ngayKham || item.appointmentDate;
                const time = item.gioKham || item.appointmentTime;
                return (
                  <article
                    key={item.maLich || item.appointmentId}
                    className="rounded-2xl border border-slate-100 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                          {item.maLich || item.appointmentId}
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {date ? dayjs(date).format("dddd, DD/MM/YYYY") : "-"}
                          {time ? ` • ${time}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          Bác sĩ: {item.BacSi?.hoTen || item.maBS || "Đang phân công"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    {item.ghiChu && (
                      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        {item.ghiChu}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LichHenKhamPage;
