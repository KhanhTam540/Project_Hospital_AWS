import React, { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import toast from "react-hot-toast";
import {
  Calendar,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Stethoscope,
  Users,
  X,
  Save,
} from "lucide-react";
import ScheduleWeekGrid from "../../../components/schedule/ScheduleWeekGrid";
import { useStaffPermission } from "../../../auth/useStaffPermission";
import {
  getAllSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getShiftList,
  getDoctorList,
  getStaffByAccount,
} from "../../../services/nhansu/hrScheduleService";

dayjs.extend(isoWeek);

const getWeekDays = (startDate) =>
  [...Array(7)].map((_, i) => dayjs(startDate).add(i, "day"));

const HRLichLamViecPage = ({ readOnly = false, accent = "amber" }) => {
  const { can } = useStaffPermission();
  const canManage = !readOnly && can("schedule.manage");

  const [list, setList] = useState([]);
  const [caList, setCaList] = useState([]);
  const [bacSiList, setBacSiList] = useState([]);
  const [maNS, setMaNS] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(
    dayjs().startOf("isoWeek").format("YYYY-MM-DD")
  );
  const [selectedBacSi, setSelectedBacSi] = useState("all");
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    maBS: "",
    maCa: "",
    ngayLamViec: dayjs().format("YYYY-MM-DD"),
    createForWeek: false,
  });

  const weekDays = useMemo(() => getWeekDays(selectedWeek), [selectedWeek]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAllSchedules();
      setList(res.data.data || []);
    } catch {
      toast.error("Không tải được lịch làm việc");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    getShiftList()
      .then((res) => setCaList(res.data.data || []))
      .catch(() => toast.error("Không tải được danh sách ca"));
    getDoctorList()
      .then((res) => setBacSiList(res.data.data || []))
      .catch(() => toast.error("Không tải được danh sách bác sĩ"));

    const maTK = localStorage.getItem("maTK");
    if (maTK) {
      getStaffByAccount(maTK)
        .then((res) => setMaNS(res.data.data?.maNS || ""))
        .catch(() => {});
    }
  }, [fetchData]);

  const filteredList = useMemo(() => {
    if (selectedBacSi === "all") return list;
    return list.filter(
      (l) => l.maBS === selectedBacSi || l.BacSi?.maBS === selectedBacSi
    );
  }, [list, selectedBacSi]);

  const weekStart = dayjs(selectedWeek).format("YYYY-MM-DD");
  const weekEnd = dayjs(selectedWeek).add(7, "day").format("YYYY-MM-DD");

  const listInWeek = useMemo(
    () =>
      filteredList.filter((l) => {
        const d = dayjs(l.ngayLamViec).format("YYYY-MM-DD");
        return d >= weekStart && d < weekEnd;
      }),
    [filteredList, weekStart, weekEnd]
  );

  const bacSiInWeek = useMemo(
    () =>
      new Set(
        listInWeek.map((l) => l.maBS || l.BacSi?.maBS).filter(Boolean)
      ).size,
    [listInWeek]
  );

  const getLichForDayAndCa = useCallback(
    (date, maCa) => {
      const dateStr = dayjs(date).format("YYYY-MM-DD");
      return filteredList.filter((l) => {
        const lichDate = dayjs(l.ngayLamViec).format("YYYY-MM-DD");
        const lichCa = l.maCa || l.CaKham?.maCa;
        return lichDate === dateStr && lichCa === maCa;
      });
    },
    [filteredList]
  );

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!form.maBS || !form.maCa || !form.ngayLamViec) {
      toast.error("Vui lòng chọn bác sĩ, ca và ngày");
      return;
    }

    try {
      await createSchedule({
        maBS: form.maBS,
        maCa: form.maCa,
        ngayLamViec: form.ngayLamViec,
        maNS: maNS || undefined,
        createForWeek: form.createForWeek,
      });
      toast.success(
        form.createForWeek
          ? "Đã phân ca cho cả tuần"
          : "Đã phân ca thành công"
      );
      setForm((prev) => ({ ...prev, maCa: "", createForWeek: false }));
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Phân ca thất bại");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Xóa ca làm việc này?")) return;
    try {
      await deleteSchedule(id);
      toast.success("Đã xóa ca");
      fetchData();
    } catch {
      toast.error("Xóa thất bại");
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    try {
      await updateSchedule(editItem.maLichLV, {
        maBS: editItem.maBS,
        maCa: editItem.maCa,
        ngayLamViec: editItem.ngayLamViec,
        maNS: maNS || editItem.maNS,
      });
      toast.success("Cập nhật thành công");
      setEditItem(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cập nhật thất bại");
    }
  };

  const accentRing = accent === "amber" ? "ring-amber-500" : "ring-blue-500";
  const accentBtn =
    accent === "amber"
      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
      : "bg-blue-600 hover:bg-blue-700 shadow-blue-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl bg-gradient-to-br ${
              accent === "amber"
                ? "from-amber-500 to-yellow-600"
                : "from-blue-500 to-indigo-600"
            } text-white shadow-lg`}
          >
            <Calendar size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {canManage ? "Phân ca làm việc bác sĩ" : "Lịch làm việc bác sĩ"}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {canManage
                ? "Điều phối và phân công ca khám cho bác sĩ — tối đa 10 bệnh nhân/ca"
                : "Xem lịch phân ca bác sĩ theo tuần"}
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-lg border border-gray-200">
          Tuần{" "}
          <span className="font-semibold text-gray-700">
            {dayjs(selectedWeek).format("DD/MM")} –{" "}
            {dayjs(selectedWeek).add(6, "day").format("DD/MM/YYYY")}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Ca trong tuần</p>
            <p className="text-xl font-bold text-gray-800">{listInWeek.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-green-100 text-green-700">
            <Stethoscope size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Bác sĩ có ca</p>
            <p className="text-xl font-bold text-gray-800">{bacSiInWeek}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
            <Users size={20} />
          </div>
          <div>
            <p className="text-xs text-gray-500">Tổng ca đã phân</p>
            <p className="text-xl font-bold text-gray-800">{filteredList.length}</p>
          </div>
        </div>
      </div>

      {/* Assign form */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarPlus size={20} className="text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-800">Phân ca mới</h2>
          </div>
          <form
            onSubmit={handleAssign}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bác sĩ *
              </label>
              <select
                name="maBS"
                value={form.maBS}
                onChange={handleFormChange}
                required
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 ${accentRing}`}
              >
                <option value="">— Chọn bác sĩ —</option>
                {bacSiList.map((bs) => (
                  <option key={bs.maBS} value={bs.maBS}>
                    {bs.hoTen} {bs.chuyenMon ? `(${bs.chuyenMon})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ca khám *
              </label>
              <select
                name="maCa"
                value={form.maCa}
                onChange={handleFormChange}
                required
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 ${accentRing}`}
              >
                <option value="">— Chọn ca —</option>
                {caList.map((ca) => (
                  <option key={ca.maCa} value={ca.maCa}>
                    {ca.tenCa} ({ca.thoiGianBatDau}–{ca.thoiGianKetThuc})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày bắt đầu *
              </label>
              <input
                type="date"
                name="ngayLamViec"
                value={form.ngayLamViec}
                onChange={handleFormChange}
                required
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 ${accentRing}`}
              />
            </div>
            <div className="flex items-center gap-2 pb-2.5">
              <input
                type="checkbox"
                id="createForWeek"
                name="createForWeek"
                checked={form.createForWeek}
                onChange={handleFormChange}
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="createForWeek" className="text-sm text-gray-700">
                Phân cả tuần (7 ngày)
              </label>
            </div>
            <button
              type="submit"
              className={`${accentBtn} text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors`}
            >
              Phân ca
            </button>
          </form>
        </div>
      )}

      {/* Filters + week nav */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Bác sĩ:</label>
          <select
            value={selectedBacSi}
            onChange={(e) => setSelectedBacSi(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Tất cả</option>
            {bacSiList.map((bs) => (
              <option key={bs.maBS} value={bs.maBS}>
                {bs.hoTen}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={() =>
              setSelectedWeek(
                dayjs(selectedWeek).subtract(1, "week").format("YYYY-MM-DD")
              )
            }
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) =>
              setSelectedWeek(
                dayjs(e.target.value).startOf("isoWeek").format("YYYY-MM-DD")
              )
            }
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() =>
              setSelectedWeek(
                dayjs(selectedWeek).add(1, "week").format("YYYY-MM-DD")
              )
            }
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            aria-label="Tuần sau"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() =>
              setSelectedWeek(dayjs().startOf("isoWeek").format("YYYY-MM-DD"))
            }
            className="text-sm font-medium text-amber-700 hover:text-amber-800 px-3 py-2 rounded-lg bg-amber-50"
          >
            Tuần này
          </button>
        </div>
      </div>

      {/* Week grid */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
        <ScheduleWeekGrid
          weekDays={weekDays}
          caList={caList}
          getLichForDayAndCa={getLichForDayAndCa}
          loading={loading}
          canManage={canManage}
          onEdit={setEditItem}
          onDelete={handleDelete}
          accent={accent}
        />
      </div>

      {/* Edit modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Sửa ca làm việc</h3>
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bác sĩ
                </label>
                <select
                  value={editItem.maBS || ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, maBS: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {bacSiList.map((bs) => (
                    <option key={bs.maBS} value={bs.maBS}>
                      {bs.hoTen}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ca khám
                </label>
                <select
                  value={editItem.maCa || editItem.CaKham?.maCa || ""}
                  onChange={(e) =>
                    setEditItem({ ...editItem, maCa: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {caList.map((ca) => (
                    <option key={ca.maCa} value={ca.maCa}>
                      {ca.tenCa}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày làm việc
                </label>
                <input
                  type="date"
                  value={dayjs(editItem.ngayLamViec).format("YYYY-MM-DD")}
                  onChange={(e) =>
                    setEditItem({ ...editItem, ngayLamViec: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditItem(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRLichLamViecPage;
