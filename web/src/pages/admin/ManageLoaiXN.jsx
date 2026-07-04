import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import toast from "react-hot-toast";
import { Edit3, FlaskConical, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  maLoaiXN: "",
  tenLoai: "",
  moTa: "",
  trangThai: 1,
});

function ManageLoaiXN() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchItems = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await axios.get("/loaixetnghiem");
      setItems(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải loại xét nghiệm"));
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.maLoaiXN, item.tenLoai, item.moTa]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [items, search]);

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
    if (!form.tenLoai.trim()) {
      toast.error("Tên loại xét nghiệm là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tenLoai: form.tenLoai.trim(),
        moTa: form.moTa.trim(),
      };

      if (form.maLoaiXN) {
        const response = await axios.put(
          `/loaixetnghiem/${encodeURIComponent(form.maLoaiXN)}`,
          payload,
        );
        const updated = unwrapApiResponse(response, payload);
        setItems((current) =>
          current.map((item) => item.maLoaiXN === form.maLoaiXN ? updated : item),
        );
        toast.success("Cập nhật loại xét nghiệm thành công");
      } else {
        const response = await axios.post("/loaixetnghiem", payload);
        const created = unwrapApiResponse(response, payload);
        setItems((current) => [created, ...current]);
        toast.success("Thêm loại xét nghiệm thành công");
      }

      setForm(null);
      await fetchItems({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu loại xét nghiệm"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa loại xét nghiệm “${item.tenLoai}”?`)) return;
    setDeletingId(item.maLoaiXN);
    try {
      await axios.delete(`/loaixetnghiem/${encodeURIComponent(item.maLoaiXN)}`);
      setItems((current) => current.filter((row) => row.maLoaiXN !== item.maLoaiXN));
      toast.success("Đã xóa loại xét nghiệm");
      await fetchItems({ silent: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể xóa. Loại xét nghiệm có thể đang được sử dụng.",
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Danh mục cận lâm sàng</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Loại xét nghiệm</h1>
          <p className="mt-1 text-sm text-slate-500">Dữ liệu được lấy trực tiếp từ DynamoDB.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fetchItems()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold"><RefreshCw size={17} /> Làm mới</button>
          <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 font-bold text-white hover:bg-teal-700"><Plus size={18} /> Thêm loại</button>
        </div>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, tên hoặc mô tả..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500">Đang tải loại xét nghiệm...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500"><FlaskConical className="mx-auto mb-3 text-slate-300" size={48} />Chưa có loại xét nghiệm.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">Mã</th><th className="px-5 py-4">Tên loại</th><th className="px-5 py-4">Mô tả</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4 text-center">Thao tác</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {pagination.pageItems.map((item) => (
                  <tr key={item.maLoaiXN} className="hover:bg-teal-50/40">
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{item.maLoaiXN}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">{item.tenLoai}</td>
                    <td className="max-w-md px-5 py-4 text-slate-600">{item.moTa || "—"}</td>
                    <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(item.trangThai) === 0 ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{Number(item.trangThai) === 0 ? "Ngừng dùng" : "Đang dùng"}</span></td>
                    <td className="px-5 py-4"><div className="flex justify-center gap-2"><button type="button" onClick={() => setForm({ ...EMPTY_FORM, ...item })} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"><Edit3 size={18} /></button><button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.maLoaiXN} className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"><Trash2 size={18} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="loại xét nghiệm" />
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black">{form.maLoaiXN ? "Cập nhật loại xét nghiệm" : "Thêm loại xét nghiệm"}</h2><button type="button" onClick={() => !saving && setForm(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <label className="block"><span className="mb-1 block text-sm font-semibold">Tên loại *</span><input name="tenLoai" value={form.tenLoai} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">Mô tả</span><textarea name="moTa" value={form.moTa} onChange={handleChange} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="block"><span className="mb-1 block text-sm font-semibold">Trạng thái</span><select name="trangThai" value={form.trangThai} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value={1}>Đang sử dụng</option><option value={0}>Ngừng sử dụng</option></select></label>
              <div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-teal-600 px-5 py-2 font-bold text-white disabled:bg-slate-400">{saving ? "Đang lưu..." : "Lưu loại xét nghiệm"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageLoaiXN;
