import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

import { resolveCurrentDoctor } from "../../../services/bacsi/bacsiService";
import {
  createLich,
  deleteLich,
  getCaTruc,
  getLichByBS,
  getSoLuongBenhNhan,
} from "../../../services/lich/lichlamviecService";
import { getApiErrorMessage } from "../../../utils/apiResponse";

const mondayOf = (value) => {
  const date = dayjs(value);
  const day = date.day();
  return date.subtract(day === 0 ? 6 : day - 1, "day").startOf("day");
};

const formatTime = (value) => String(value || "").slice(0, 5);

const PatientCountBadge = ({ doctorId, shiftId, workDate }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;

    getSoLuongBenhNhan({
      maBS: doctorId,
      maCa: shiftId,
      ngayLamViec: workDate,
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setData({ soLuong: 0, toiDa: 10, conLai: 10 });
      });

    return () => {
      active = false;
    };
  }, [doctorId, shiftId, workDate]);

  if (!data) {
    return <span className="text-xs text-gray-400">Đang tải...</span>;
  }

  const current = Number(data.soLuong || 0);
  const maximum = Number(data.toiDa || 10);
  const isFull = current >= maximum;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        isFull
          ? "bg-red-100 text-red-700"
          : current >= maximum * 0.8
            ? "bg-amber-100 text-amber-700"
            : "bg-green-100 text-green-700"
      }`}
    >
      {current}/{maximum} bệnh nhân
    </span>
  );
};

const LichLamViecPage = () => {
  const [doctor, setDoctor] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(
    mondayOf(dayjs()).format("YYYY-MM-DD"),
  );
  const [form, setForm] = useState({
    maCa: "",
    ngayLamViec: dayjs().add(1, "day").format("YYYY-MM-DD"),
    createForWeek: false,
  });

  const doctorId = doctor?.maBS || doctor?.doctorId || "";

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        dayjs(selectedWeek).add(index, "day"),
      ),
    [selectedWeek],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const currentDoctor = await resolveCurrentDoctor({ forceRefresh: true });
      const currentDoctorId = currentDoctor?.maBS || currentDoctor?.doctorId;
      if (!currentDoctorId) {
        throw new Error("Không xác định được mã bác sĩ đang đăng nhập");
      }

      const [scheduleItems, shiftItems] = await Promise.all([
        getLichByBS(currentDoctorId),
        getCaTruc(),
      ]);

      setDoctor(currentDoctor);
      setSchedules(scheduleItems);
      setShifts(shiftItems);
    } catch (error) {
      setDoctor(null);
      setSchedules([]);
      setShifts([]);
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể tải lịch làm việc của bác sĩ",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const shiftMap = useMemo(
    () => new Map(shifts.map((shift) => [shift.maCa || shift.shiftId, shift])),
    [shifts],
  );

  const schedulesByDate = useMemo(() => {
    const result = new Map();
    for (const schedule of schedules) {
      const dateKey = dayjs(
        schedule.ngayLamViec || schedule.workDate,
      ).format("YYYY-MM-DD");
      const current = result.get(dateKey) || [];
      current.push(schedule);
      result.set(dateKey, current);
    }
    return result;
  }, [schedules]);

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!doctorId) {
      toast.error("Không xác định được mã bác sĩ");
      return;
    }
    if (!form.maCa || !form.ngayLamViec) {
      toast.error("Vui lòng chọn ca trực và ngày làm việc");
      return;
    }

    setSubmitting(true);
    try {
      await createLich({
        // Backend sẽ tự đối chiếu và thay bằng doctorId lấy từ JWT.
        maBS: doctorId,
        maCa: form.maCa,
        ngayLamViec: form.ngayLamViec,
        createForWeek: form.createForWeek,
      });

      toast.success(
        form.createForWeek
          ? "Đăng ký lịch cho 7 ngày thành công"
          : "Đăng ký lịch làm việc thành công",
      );
      setSelectedWeek(mondayOf(form.ngayLamViec).format("YYYY-MM-DD"));
      setForm((current) => ({
        ...current,
        maCa: "",
        createForWeek: false,
      }));
      await loadData();
    } catch (error) {
      const code =
        error.response?.data?.error?.code || error.response?.data?.code;
      toast.error(
        code === "TRANSACTION_CONFLICT" || error.response?.status === 409
          ? "Ca làm việc này đã được đăng ký"
          : getApiErrorMessage(error, "Không thể đăng ký lịch làm việc"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (schedule) => {
    if (!window.confirm("Bạn có chắc muốn xóa lịch làm việc này?")) return;

    try {
      await deleteLich(schedule.maLichLV || schedule.scheduleId);
      toast.success("Đã xóa lịch làm việc");
      await loadData();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Không thể xóa lịch làm việc"),
      );
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-4 md:p-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Lịch làm việc của bác sĩ</h1>
        <p className="mt-1 text-blue-100">
          {doctor?.hoTen || doctor?.fullName || "Bác sĩ"} · {doctorId || "Chưa xác định mã bác sĩ"}
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 shadow md:grid-cols-4"
      >
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Ca trực
          </label>
          <select
            value={form.maCa}
            onChange={(event) =>
              setForm((current) => ({ ...current, maCa: event.target.value }))
            }
            disabled={loading || shifts.length === 0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100"
            required
          >
            <option value="">-- Chọn ca --</option>
            {shifts.map((shift) => {
              const shiftId = shift.maCa || shift.shiftId;
              return (
                <option key={shiftId} value={shiftId}>
                  {shift.tenCa || shift.shiftName} ({formatTime(shift.thoiGianBatDau || shift.startTime)} - {formatTime(shift.thoiGianKetThuc || shift.endTime)})
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Ngày làm việc
          </label>
          <input
            type="date"
            value={form.ngayLamViec}
            min={dayjs().format("YYYY-MM-DD")}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                ngayLamViec: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            required
          />
        </div>

        <label className="flex items-center gap-2 self-end rounded-lg border border-gray-200 px-3 py-2">
          <input
            type="checkbox"
            checked={form.createForWeek}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                createForWeek: event.target.checked,
              }))
            }
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700">Đăng ký liên tiếp 7 ngày</span>
        </label>

        <button
          type="submit"
          disabled={submitting || loading || !doctorId || shifts.length === 0}
          className="self-end rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Đang đăng ký..." : "Đăng ký lịch"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow">
        <button
          type="button"
          onClick={() =>
            setSelectedWeek(
              dayjs(selectedWeek).subtract(7, "day").format("YYYY-MM-DD"),
            )
          }
          className="rounded-lg bg-gray-100 px-4 py-2 hover:bg-gray-200"
        >
          ← Tuần trước
        </button>
        <div className="font-semibold text-gray-800">
          {dayjs(selectedWeek).format("DD/MM/YYYY")} - {dayjs(selectedWeek).add(6, "day").format("DD/MM/YYYY")}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setSelectedWeek(mondayOf(dayjs()).format("YYYY-MM-DD"))
            }
            className="rounded-lg bg-blue-50 px-4 py-2 text-blue-700 hover:bg-blue-100"
          >
            Tuần hiện tại
          </button>
          <button
            type="button"
            onClick={() =>
              setSelectedWeek(
                dayjs(selectedWeek).add(7, "day").format("YYYY-MM-DD"),
              )
            }
            className="rounded-lg bg-gray-100 px-4 py-2 hover:bg-gray-200"
          >
            Tuần sau →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-10 text-center text-gray-500 shadow">
          Đang tải lịch làm việc...
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-xl bg-amber-50 p-6 text-center text-amber-700 shadow">
          Chưa có ca trực hoạt động. Quản trị viên hoặc nhân sự cần tạo ca trực trước.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
          {weekDays.map((date) => {
            const dateKey = date.format("YYYY-MM-DD");
            const daySchedules = schedulesByDate.get(dateKey) || [];

            return (
              <section
                key={dateKey}
                className="min-h-48 rounded-xl bg-white p-3 shadow"
              >
                <div className="border-b pb-2 text-center">
                  <div className="text-sm font-semibold text-gray-700">
                    {date.format("dddd")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {date.format("DD/MM")}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {daySchedules.length === 0 ? (
                    <p className="py-5 text-center text-xs text-gray-400">
                      Chưa đăng ký
                    </p>
                  ) : (
                    daySchedules.map((schedule) => {
                      const shiftId = schedule.maCa || schedule.shiftId;
                      const shift =
                        schedule.CaKham || shiftMap.get(shiftId) || {};
                      return (
                        <article
                          key={schedule.maLichLV || schedule.scheduleId}
                          className="rounded-lg border border-blue-100 bg-blue-50 p-3"
                        >
                          <div className="font-semibold text-blue-800">
                            {shift.tenCa || shift.shiftName || shiftId}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {formatTime(shift.thoiGianBatDau || shift.startTime)} - {formatTime(shift.thoiGianKetThuc || shift.endTime)}
                          </div>
                          <div className="mt-2">
                            <PatientCountBadge
                              doctorId={doctorId}
                              shiftId={shiftId}
                              workDate={dateKey}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(schedule)}
                            className="mt-3 text-xs font-medium text-red-600 hover:underline"
                          >
                            Xóa lịch
                          </button>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LichLamViecPage;
