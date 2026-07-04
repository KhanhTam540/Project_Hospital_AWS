import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  Calendar,
  Edit3,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  maBN: "",
  hoTen: "",
  ngaySinh: "",
  gioiTinh: "Nam",
  diaChi: "",
  soDienThoai: "",
  email: "",
  bhyt: "",
  trangThai: 1,
});

function normalizePatient(item = {}) {
  return {
    ...EMPTY_FORM,
    ...item,
    maBN: item.maBN || item.patientId || "",
    hoTen: item.hoTen || item.fullName || "",
    ngaySinh: String(item.ngaySinh || item.birthDate || "").slice(0, 10),
    gioiTinh: item.gioiTinh || item.gender || "Nam",
    diaChi: item.diaChi || item.address || "",
    soDienThoai: item.soDienThoai || item.phoneNumber || "",
    email: item.email || "",
    bhyt:
      item.bhyt || item.healthInsurance || item.healthInsuranceNumber || "",
    trangThai: Number(item.trangThai ?? (item.status === "INACTIVE" ? 0 : 1)),
  };
}

function ManageBenhNhan() {
  const [patients, setPatients] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchPatients = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get("/benhnhan");
      setPatients(
        ensureArray(unwrapApiResponse(response, [])).map(normalizePatient),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách bệnh nhân"));
      if (!silent) setPatients([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return patients;
    return patients.filter((patient) =>
      [
        patient.maBN,
        patient.hoTen,
        patient.soDienThoai,
        patient.email,
        patient.bhyt,
        patient.diaChi,
      ].some((value) =>
        String(value || "").toLowerCase().includes(keyword),
      ),
    );
  }, [patients, search]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: search,
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "trangThai" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form) return;
    if (!form.hoTen.trim()) {
      toast.error("Họ tên bệnh nhân là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        hoTen: form.hoTen.trim(),
        ngaySinh: form.ngaySinh || undefined,
        diaChi: form.diaChi.trim(),
        soDienThoai: form.soDienThoai.trim(),
        email: form.email.trim(),
        bhyt: form.bhyt.trim(),
      };

      if (form.maBN) {
        const response = await axios.put(
          `/benhnhan/${encodeURIComponent(form.maBN)}`,
          payload,
        );
        const updated = normalizePatient(unwrapApiResponse(response, payload));
        setPatients((current) =>
          current.map((item) => (item.maBN === form.maBN ? updated : item)),
        );
        toast.success("Cập nhật bệnh nhân thành công");
      } else {
        const response = await axios.post("/benhnhan", payload);
        const created = normalizePatient(unwrapApiResponse(response, payload));
        setPatients((current) => [created, ...current]);
        toast.success("Thêm bệnh nhân thành công");
      }

      setForm(null);
      await fetchPatients({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu bệnh nhân"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (patient) => {
    if (!window.confirm(`Xóa bệnh nhân ${patient.hoTen}?`)) return;
    setDeletingId(patient.maBN);
    try {
      await axios.delete(`/benhnhan/${encodeURIComponent(patient.maBN)}`);
      setPatients((current) =>
        current.filter((item) => item.maBN !== patient.maBN),
      );
      toast.success("Đã xóa bệnh nhân");
      await fetchPatients({ silent: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể xóa bệnh nhân. Bệnh nhân có thể đang có hồ sơ hoặc lịch khám liên quan.",
        ),
      );
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-600">
            Hồ sơ người bệnh
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Quản lý bệnh nhân
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Thêm, xem, chỉnh sửa và xóa hồ sơ bệnh nhân trên DynamoDB.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchPatients()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} /> Làm mới
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 font-bold text-white hover:bg-purple-700"
          >
            <Plus size={18} /> Thêm bệnh nhân
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
          placeholder="Tìm theo mã, họ tên, số điện thoại, email hoặc BHYT..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            Đang tải danh sách bệnh nhân...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Users className="mx-auto mb-3 text-slate-300" size={48} />
            Chưa có bệnh nhân phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4">Mã</th>
                  <th className="px-5 py-4">Họ tên</th>
                  <th className="px-5 py-4">Liên hệ</th>
                  <th className="px-5 py-4">Ngày sinh</th>
                  <th className="px-5 py-4">BHYT</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((patient) => (
                  <tr key={patient.maBN} className="hover:bg-purple-50/40">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {patient.maBN}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{patient.hoTen}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {patient.gioiTinh}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <p className="inline-flex items-center gap-1">
                        <Phone size={14} /> {patient.soDienThoai || "—"}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                        <MapPin size={13} /> {patient.diaChi || "—"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={14} />
                        {patient.ngaySinh
                          ? dayjs(patient.ngaySinh).format("DD/MM/YYYY")
                          : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {patient.bhyt || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          Number(patient.trangThai) === 0
                            ? "bg-slate-100 text-slate-600"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {Number(patient.trangThai) === 0
                          ? "Ngừng hoạt động"
                          : "Đang hoạt động"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm(normalizePatient(patient))}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"
                          title="Sửa"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(patient)}
                          disabled={deletingId === patient.maBN}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          title="Xóa"
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
          <AdminPagination pagination={pagination} itemLabel="bệnh nhân" />
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-xl font-black text-slate-900">
                {form.maBN ? "Cập nhật bệnh nhân" : "Thêm bệnh nhân"}
              </h2>
              <button
                type="button"
                onClick={() => !saving && setForm(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Họ tên *</span>
                <input
                  name="hoTen"
                  value={form.hoTen}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Ngày sinh</span>
                <input
                  type="date"
                  name="ngaySinh"
                  value={form.ngaySinh}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Giới tính</span>
                <select
                  name="gioiTinh"
                  value={form.gioiTinh}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                >
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Số điện thoại</span>
                <input
                  name="soDienThoai"
                  value={form.soDienThoai}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Email</span>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Địa chỉ</span>
                <input
                  name="diaChi"
                  value={form.diaChi}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Số BHYT</span>
                <input
                  name="bhyt"
                  value={form.bhyt}
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
                  <option value={1}>Đang hoạt động</option>
                  <option value={0}>Ngừng hoạt động</option>
                </select>
              </label>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-600 px-5 py-2 font-bold text-white disabled:bg-slate-400"
                >
                  {saving ? "Đang lưu..." : "Lưu bệnh nhân"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageBenhNhan;
