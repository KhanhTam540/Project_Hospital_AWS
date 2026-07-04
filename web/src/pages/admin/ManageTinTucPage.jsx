import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  Calendar,
  Edit3,
  Eye,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  createTinTuc,
  deleteTinTuc,
  getAllTinTuc,
  updateTinTuc,
} from "../../services/tintuc/tintucService";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  maTin: "",
  tieuDe: "",
  tomTat: "",
  noiDung: "",
  loai: "TIN_TUC",
  hinhAnh: "",
  trangThai: "HIEN_THI",
});

function ManageTinTucPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchItems = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.trangThai = statusFilter;
      const response = await getAllTinTuc(params);
      setItems(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải tin tức"));
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.maTin, item.tieuDe, item.tomTat, item.loai]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [items, search]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: search,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.tieuDe.trim() || !String(form.noiDung || "").replace(/<[^>]*>/g, "").trim()) {
      toast.error("Tiêu đề và nội dung là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tieuDe: form.tieuDe.trim(),
        tomTat: form.tomTat.trim(),
        hinhAnh: form.hinhAnh.trim(),
      };

      if (form.maTin) {
        const response = await updateTinTuc(form.maTin, payload);
        const updated = unwrapApiResponse(response, payload);
        setItems((current) =>
          current.map((item) => item.maTin === form.maTin ? updated : item),
        );
        toast.success("Cập nhật tin tức thành công");
      } else {
        const response = await createTinTuc(payload);
        const created = unwrapApiResponse(response, payload);
        setItems((current) => [created, ...current]);
        toast.success("Tạo tin tức thành công");
      }

      setForm(null);
      await fetchItems({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu tin tức"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa tin “${item.tieuDe}”?`)) return;
    setDeletingId(item.maTin);
    try {
      await deleteTinTuc(item.maTin);
      setItems((current) => current.filter((row) => row.maTin !== item.maTin));
      toast.success("Đã xóa tin tức");
      await fetchItems({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa tin tức"));
    } finally {
      setDeletingId("");
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Truyền thông bệnh viện</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Quản lý tin tức</h1>
          <p className="mt-1 text-sm text-slate-500">Tin có trạng thái Hiển thị sẽ xuất hiện ngoài trang chủ.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fetchItems()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold"><RefreshCw size={17} /> Làm mới</button>
          <button type="button" onClick={() => setForm({ ...EMPTY_FORM })} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white hover:bg-emerald-700"><Plus size={18} /> Thêm tin</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tiêu đề, tóm tắt hoặc loại tin..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700"><option value="">Tất cả trạng thái</option><option value="HIEN_THI">Hiển thị</option><option value="AN">Ẩn</option></select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-12 text-center text-slate-500">Đang tải tin tức...</div> : filtered.length === 0 ? <div className="p-12 text-center text-slate-500"><Newspaper className="mx-auto mb-3 text-slate-300" size={48} />Chưa có tin tức phù hợp.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">Tin tức</th><th className="px-5 py-4">Loại</th><th className="px-5 py-4">Ngày đăng</th><th className="px-5 py-4">Lượt xem</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4 text-center">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pagination.pageItems.map((item) => <tr key={item.maTin} className="hover:bg-emerald-50/30"><td className="max-w-xl px-5 py-4"><div className="flex items-start gap-3">{item.hinhAnh ? <img src={item.hinhAnh} alt="" className="h-14 w-20 rounded-lg object-cover" /> : <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-slate-100 text-slate-400"><Newspaper size={20} /></div>}<div><p className="font-bold text-slate-900">{item.tieuDe}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.tomTat || "Không có tóm tắt"}</p></div></div></td><td className="px-5 py-4 text-slate-600">{item.loai}</td><td className="px-5 py-4 text-slate-500"><span className="inline-flex items-center gap-1"><Calendar size={15} />{item.ngayDang ? dayjs(item.ngayDang).format("DD/MM/YYYY") : "—"}</span></td><td className="px-5 py-4 text-slate-500"><span className="inline-flex items-center gap-1"><Eye size={15} />{item.luotXem || 0}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.trangThai === "HIEN_THI" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{item.trangThai === "HIEN_THI" ? "Hiển thị" : "Ẩn"}</span></td><td className="px-5 py-4"><div className="flex justify-center gap-2"><button type="button" onClick={() => setForm({ ...EMPTY_FORM, ...item })} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100" title="Sửa"><Edit3 size={18} /></button><button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.maTin} className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50" title="Xóa"><Trash2 size={18} /></button></div></td></tr>)}</tbody></table></div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="tin tức" />
        </div>
      )}

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><h2 className="text-xl font-black">{form.maTin ? "Cập nhật tin tức" : "Thêm tin tức"}</h2><button type="button" onClick={() => !saving && setForm(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2">
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Tiêu đề *</span><input value={form.tieuDe} onChange={(event) => setForm((current) => ({ ...current, tieuDe: event.target.value }))} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label><span className="mb-1 block text-sm font-semibold">Loại tin</span><select value={form.loai} onChange={(event) => setForm((current) => ({ ...current, loai: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="TIN_TUC">Tin tức</option><option value="THONG_BAO">Thông báo</option><option value="HUONG_DAN">Hướng dẫn</option></select></label>
              <label><span className="mb-1 block text-sm font-semibold">Trạng thái</span><select value={form.trangThai} onChange={(event) => setForm((current) => ({ ...current, trangThai: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="HIEN_THI">Hiển thị</option><option value="AN">Ẩn</option></select></label>
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Tóm tắt</span><textarea value={form.tomTat} onChange={(event) => setForm((current) => ({ ...current, tomTat: event.target.value }))} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">URL hình ảnh</span><input value={form.hinhAnh} onChange={(event) => setForm((current) => ({ ...current, hinhAnh: event.target.value }))} placeholder="https://..." className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
              <div className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Nội dung *</span><div className="rounded-lg border border-slate-300 bg-white"><ReactQuill theme="snow" value={form.noiDung} onChange={(value) => setForm((current) => ({ ...current, noiDung: value }))} className="min-h-[280px] pb-12" /></div></div>
              <div className="flex justify-end gap-3 border-t pt-4 md:col-span-2"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-5 py-2 font-bold text-white disabled:bg-slate-400">{saving ? "Đang lưu..." : "Lưu tin tức"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageTinTucPage;
