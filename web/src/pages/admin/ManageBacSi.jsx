import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import toast from "react-hot-toast";
import { Edit3, Plus, RefreshCw, Search, Stethoscope, Trash2, X } from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  maBS: "",
  hoTen: "",
  maKhoa: "",
  chuyenMon: "",
  trinhDo: "",
  chucVu: "",
  capBac: "",
  hinhAnh: "",
  trangThai: 1,
});

function ManageBacSi() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchDoctors = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get("/bacsi");
      setDoctors(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách bác sĩ"));
      if (!silent) setDoctors([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await axios.get("/khoa");
      setDepartments(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách khoa"));
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchDoctors(), fetchDepartments()]);
  }, [fetchDepartments, fetchDoctors]);

  const filteredDoctors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return doctors;
    return doctors.filter((doctor) =>
      [doctor.maBS, doctor.hoTen, doctor.chuyenMon, doctor.Khoa?.tenKhoa]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [doctors, search]);

  const pagination = useAdminPagination(filteredDoctors, {
    initialPageSize: 10,
    resetKey: search,
  });

  const openCreate = () => setForm({ ...EMPTY_FORM });
  const openEdit = (doctor) => setForm({ ...EMPTY_FORM, ...doctor });
  const closeForm = () => !saving && setForm(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === "trangThai" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.hoTen.trim() || !form.maKhoa) {
      toast.error("Họ tên và khoa là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        hoTen: form.hoTen.trim(),
        chuyenMon: form.chuyenMon.trim(),
        trinhDo: form.trinhDo.trim(),
        chucVu: form.chucVu.trim(),
        capBac: form.capBac.trim(),
        hinhAnh: form.hinhAnh.trim(),
      };

      if (form.maBS) {
        const response = await axios.put(`/bacsi/${encodeURIComponent(form.maBS)}`, payload);
        const updated = unwrapApiResponse(response, payload);
        setDoctors((current) =>
          current.map((item) => (item.maBS === form.maBS ? updated : item)),
        );
        toast.success("Cập nhật bác sĩ thành công");
      } else {
        const response = await axios.post("/bacsi", payload);
        const created = unwrapApiResponse(response, payload);
        setDoctors((current) => [created, ...current]);
        toast.success("Thêm bác sĩ thành công");
      }

      setForm(null);
      await fetchDoctors({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu bác sĩ"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doctor) => {
    if (!window.confirm(`Xóa bác sĩ ${doctor.hoTen}?`)) return;

    setDeletingId(doctor.maBS);
    try {
      await axios.delete(`/bacsi/${encodeURIComponent(doctor.maBS)}`);

      // Cập nhật bảng ngay, không cần người dùng F5.
      setDoctors((current) => current.filter((item) => item.maBS !== doctor.maBS));
      toast.success("Đã xóa bác sĩ khỏi hệ thống");

      // Đồng bộ lại từ DB để bảo đảm giao diện phản ánh dữ liệu thật.
      await fetchDoctors({ silent: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể xóa bác sĩ. Bác sĩ có thể đang có lịch hoặc hồ sơ liên quan.",
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Nhân sự chuyên môn</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Quản lý bác sĩ</h1>
          <p className="mt-1 text-sm text-slate-500">Dữ liệu được đọc và cập nhật trực tiếp từ DynamoDB.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchDoctors()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} /> Làm mới
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-bold text-white hover:bg-blue-700"
          >
            <Plus size={18} /> Thêm bác sĩ
          </button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm mã, họ tên, chuyên môn hoặc khoa..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải danh sách bác sĩ...</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Stethoscope className="mx-auto mb-3 text-slate-300" size={48} />
            Chưa có bác sĩ phù hợp.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-4">Mã</th>
                  <th className="px-5 py-4">Họ tên</th>
                  <th className="px-5 py-4">Khoa</th>
                  <th className="px-5 py-4">Chuyên môn</th>
                  <th className="px-5 py-4">Trạng thái</th>
                  <th className="px-5 py-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((doctor) => (
                  <tr key={doctor.maBS} className="hover:bg-blue-50/40">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{doctor.maBS}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">{doctor.hoTen}</td>
                    <td className="px-5 py-4 text-slate-600">{doctor.Khoa?.tenKhoa || doctor.maKhoa || "—"}</td>
                    <td className="px-5 py-4 text-slate-600">{doctor.chuyenMon || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(doctor.trangThai) === 0 ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                        {Number(doctor.trangThai) === 0 ? "Ngừng hoạt động" : "Đang hoạt động"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => openEdit(doctor)} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100" title="Sửa">
                          <Edit3 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(doctor)}
                          disabled={deletingId === doctor.maBS}
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

      {!loading && filteredDoctors.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="bác sĩ" />
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="text-xl font-black text-slate-900">{form.maBS ? "Cập nhật bác sĩ" : "Thêm bác sĩ"}</h2>
              <button type="button" onClick={closeForm} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Họ tên *</span>
                <input name="hoTen" value={form.hoTen} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Khoa *</span>
                <select name="maKhoa" value={form.maKhoa} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                  <option value="">-- Chọn khoa --</option>
                  {departments.map((item) => <option key={item.maKhoa} value={item.maKhoa}>{item.tenKhoa}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-semibold">Chuyên môn</span>
                <input name="chuyenMon" value={form.chuyenMon} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" />
              </label>
              <label><span className="mb-1 block text-sm font-semibold">Trình độ</span><input name="trinhDo" value={form.trinhDo} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label><span className="mb-1 block text-sm font-semibold">Chức vụ</span><input name="chucVu" value={form.chucVu} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label><span className="mb-1 block text-sm font-semibold">Cấp bậc</span><input name="capBac" value={form.capBac} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label><span className="mb-1 block text-sm font-semibold">Trạng thái</span><select name="trangThai" value={form.trangThai} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value={1}>Đang hoạt động</option><option value={0}>Ngừng hoạt động</option></select></label>
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">URL hình ảnh</span><input name="hinhAnh" value={form.hinhAnh} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 md:col-span-2">
                <button type="button" onClick={closeForm} className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700">Hủy</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:bg-slate-400">{saving ? "Đang lưu..." : "Lưu bác sĩ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageBacSi;
