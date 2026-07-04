import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  Calendar,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  maLich: "",
  maBS: "",
  maBN: "",
  maKhoa: "",
  ngayKham: "",
  gioKham: "",
  phong: "",
  ghiChu: "",
  trangThai: "CHO_THANH_TOAN",
});

function ManageLichKham() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [appointmentResponse, doctorResponse, patientResponse] =
        await Promise.all([
          axios.get("/lichkham"),
          axios.get("/bacsi"),
          axios.get("/benhnhan"),
        ]);
      setAppointments(ensureArray(unwrapApiResponse(appointmentResponse, [])));
      setDoctors(ensureArray(unwrapApiResponse(doctorResponse, [])));
      setPatients(ensureArray(unwrapApiResponse(patientResponse, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải dữ liệu lịch khám"));
      if (!silent) {
        setAppointments([]);
        setDoctors([]);
        setPatients([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return appointments;
    return appointments.filter((item) =>
      [
        item.maLich,
        item.BacSi?.hoTen,
        item.BenhNhan?.hoTen,
        item.phong,
        item.trangThai,
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword),
      ),
    );
  }, [appointments, search]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: search,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form?.maBN || !form?.ngayKham || !form?.gioKham) {
      toast.error("Bệnh nhân, ngày khám và giờ khám là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        allowPast: Boolean(form.maLich),
      };
      if (form.maLich) {
        const response = await axios.put(
          `/lichkham/${encodeURIComponent(form.maLich)}`,
          payload,
        );
        const updated = unwrapApiResponse(response, payload);
        setAppointments((current) =>
          current.map((item) =>
            item.maLich === form.maLich ? updated : item,
          ),
        );
        toast.success("Cập nhật lịch khám thành công");
      } else {
        const response = await axios.post("/lichkham", payload);
        const created = unwrapApiResponse(response, payload);
        setAppointments((current) => [created, ...current]);
        toast.success("Tạo lịch khám thành công");
      }
      setForm(null);
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu lịch khám"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa lịch khám ${item.maLich}?`)) return;
    setDeletingId(item.maLich);
    try {
      await axios.delete(`/lichkham/${encodeURIComponent(item.maLich)}`);
      setAppointments((current) =>
        current.filter((row) => row.maLich !== item.maLich),
      );
      toast.success("Đã xóa lịch khám");
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa lịch khám"));
    } finally {
      setDeletingId("");
    }
  };

  const statusClass = (status) => {
    if (status === "DA_THANH_TOAN") return "bg-blue-100 text-blue-700";
    if (status === "DA_KHAM") return "bg-emerald-100 text-emerald-700";
    if (status === "DA_HUY") return "bg-red-100 text-red-700";
    return "bg-amber-100 text-amber-700";
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            Điều phối khám bệnh
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Quản lý lịch khám
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchData()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold"
          >
            <RefreshCw size={17} /> Làm mới
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 font-bold text-white"
          >
            <Plus size={18} /> Tạo lịch
          </button>
        </div>
      </div>

      <div className="relative max-w-2xl">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm mã lịch, bác sĩ, bệnh nhân, phòng hoặc trạng thái..."
          className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải lịch khám...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Calendar className="mx-auto mb-3 text-slate-300" size={48} />
            Chưa có lịch khám phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4">Mã lịch</th>
                  <th className="px-5 py-4">Bệnh nhân</th>
                  <th className="px-5 py-4">Bác sĩ</th>
                  <th className="px-5 py-4">Ngày giờ</th>
                  <th className="px-5 py-4">Phòng</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((item) => (
                  <tr key={item.maLich} className="hover:bg-orange-50/30">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {item.maLich}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {item.BenhNhan?.hoTen || item.hoTenBN || item.maBN}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.BacSi?.hoTen || item.hoTenBS || item.maBS || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.ngayKham
                        ? `${dayjs(item.ngayKham).format("DD/MM/YYYY")} ${item.gioKham || ""}`
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {item.phong || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(item.trangThai)}`}
                      >
                        {item.trangThai}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...EMPTY_FORM,
                              ...item,
                              ngayKham: String(item.ngayKham || "").slice(0, 10),
                            })
                          }
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.maLich}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="lịch khám" />
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-black">
                {form.maLich ? "Cập nhật lịch khám" : "Tạo lịch khám"}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setForm(null)}
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-semibold">Bệnh nhân *</span>
                <select
                  name="maBN"
                  value={form.maBN}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="">-- Chọn bệnh nhân --</option>
                  {patients.map((patient) => (
                    <option key={patient.maBN} value={patient.maBN}>
                      {patient.hoTen} ({patient.maBN})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Bác sĩ</span>
                <select
                  name="maBS"
                  value={form.maBS}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="">-- Chọn bác sĩ --</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.maBS} value={doctor.maBS}>
                      {doctor.hoTen} ({doctor.maBS})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Ngày khám *</span>
                <input
                  type="date"
                  name="ngayKham"
                  value={form.ngayKham}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Giờ khám *</span>
                <input
                  type="time"
                  name="gioKham"
                  value={form.gioKham}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Phòng</span>
                <input
                  name="phong"
                  value={form.phong}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Trạng thái</span>
                <select
                  name="trangThai"
                  value={form.trangThai}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="CHO_THANH_TOAN">Chờ thanh toán</option>
                  <option value="DA_THANH_TOAN">Đã thanh toán</option>
                  <option value="DA_KHAM">Đã khám</option>
                  <option value="DA_HUY">Đã hủy</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Ghi chú</span>
                <textarea
                  name="ghiChu"
                  value={form.ghiChu}
                  onChange={handleChange}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <div className="flex justify-end gap-3 border-t pt-4 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-lg border px-4 py-2 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-orange-600 px-5 py-2 font-bold text-white disabled:bg-slate-400"
                >
                  {saving ? "Đang lưu..." : "Lưu lịch khám"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageLichKham;
