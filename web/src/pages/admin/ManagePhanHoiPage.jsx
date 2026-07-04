import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Clock3,
  Edit3,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  deletePhanHoi,
  getAllPhanHoi,
  getPhanHoiStats,
  updatePhanHoi,
} from "../../services/phanhoi/phanhoiService";
import {
  ensureArray,
  ensureObject,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const STATUS_OPTIONS = Object.freeze([
  ["CHO_XU_LY", "Chờ xử lý"],
  ["DANG_XU_LY", "Đang xử lý"],
  ["DA_XU_LY", "Đã xử lý"],
]);

const EMPTY_STATS = Object.freeze({
  total: 0,
  choXuLy: 0,
  dangXuLy: 0,
  daXuLy: 0,
});

function statusLabel(value) {
  return STATUS_OPTIONS.find(([status]) => status === value)?.[1] || value;
}

function ManagePhanHoiPage() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ ...EMPTY_STATS });
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [listResponse, statsResponse] = await Promise.all([
        getAllPhanHoi(statusFilter ? { trangThai: statusFilter } : {}),
        getPhanHoiStats(),
      ]);
      setItems(ensureArray(unwrapApiResponse(listResponse, [])));
      setStats({ ...EMPTY_STATS, ...ensureObject(unwrapApiResponse(statsResponse, {})) });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải phản hồi"));
      if (!silent) {
        setItems([]);
        setStats({ ...EMPTY_STATS });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [
        item.maPH,
        item.tieuDe,
        item.noiDung,
        item.BenhNhan?.hoTen,
        item.BenhNhan?.email,
      ].some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [items, search]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: `${search}|${statusFilter}`,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const response = await updatePhanHoi(form.maPH, {
        trangThai: form.trangThai,
        phanHoi: form.phanHoi,
      });
      const updated = unwrapApiResponse(response, form);
      setItems((current) =>
        current.map((item) => item.maPH === form.maPH ? updated : item),
      );
      setForm(null);
      toast.success("Đã cập nhật phản hồi");
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể cập nhật phản hồi"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa phản hồi “${item.tieuDe || item.maPH}”?`)) return;
    setDeletingId(item.maPH);
    try {
      await deletePhanHoi(item.maPH);
      setItems((current) => current.filter((row) => row.maPH !== item.maPH));
      toast.success("Đã xóa phản hồi");
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể xóa phản hồi"));
    } finally {
      setDeletingId("");
    }
  };

  const cards = [
    ["Tổng phản hồi", stats.total, MessageSquare, "bg-slate-100 text-slate-700"],
    ["Chờ xử lý", stats.choXuLy, Clock3, "bg-amber-100 text-amber-700"],
    ["Đang xử lý", stats.dangXuLy, Edit3, "bg-blue-100 text-blue-700"],
    ["Đã xử lý", stats.daXuLy, CheckCircle2, "bg-emerald-100 text-emerald-700"],
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Chăm sóc khách hàng</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Phản hồi và ý kiến</h1>
          <p className="mt-1 text-sm text-slate-500">Xem, trả lời và cập nhật trạng thái phản hồi bệnh nhân.</p>
        </div>
        <button type="button" onClick={() => fetchData()} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700"><RefreshCw size={17} /> Làm mới</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, Icon, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></div>
            <p className="text-3xl font-black text-slate-900">{Number(value || 0)}</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tiêu đề, nội dung hoặc bệnh nhân..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700"><option value="">Tất cả trạng thái</option>{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-12 text-center text-slate-500">Đang tải phản hồi...</div> : filtered.length === 0 ? <div className="p-12 text-center text-slate-500"><MessageSquare className="mx-auto mb-3 text-slate-300" size={48} />Chưa có phản hồi phù hợp.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">Bệnh nhân</th><th className="px-5 py-4">Nội dung</th><th className="px-5 py-4">Ngày gửi</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4 text-center">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pagination.pageItems.map((item) => <tr key={item.maPH} className="hover:bg-indigo-50/30"><td className="px-5 py-4"><p className="font-bold text-slate-900">{item.BenhNhan?.hoTen || item.maBN || "—"}</p><p className="text-xs text-slate-400">{item.BenhNhan?.email || item.maPH}</p></td><td className="max-w-xl px-5 py-4"><p className="font-semibold text-slate-800">{item.tieuDe || "Phản hồi"}</p><p className="mt-1 line-clamp-2 text-slate-500">{item.noiDung}</p>{item.phanHoi && <p className="mt-2 line-clamp-1 text-xs font-medium text-blue-600">Đã trả lời: {item.phanHoi}</p>}</td><td className="px-5 py-4 text-slate-500">{item.ngayGui ? dayjs(item.ngayGui).format("DD/MM/YYYY HH:mm") : "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.trangThai === "DA_XU_LY" ? "bg-emerald-100 text-emerald-700" : item.trangThai === "DANG_XU_LY" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{statusLabel(item.trangThai)}</span></td><td className="px-5 py-4"><div className="flex justify-center gap-2"><button type="button" onClick={() => setForm({ ...item })} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100" title="Xử lý"><Edit3 size={18} /></button><button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.maPH} className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50" title="Xóa"><Trash2 size={18} /></button></div></td></tr>)}</tbody></table></div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="phản hồi" />
        </div>
      )}

      {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black text-slate-900">Xử lý phản hồi</h2><p className="mt-1 text-sm text-slate-500">{form.tieuDe || form.maPH}</p></div><button type="button" onClick={() => !saving && setForm(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div><form onSubmit={handleSubmit} className="space-y-4 p-5"><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{form.noiDung}</div><label className="block"><span className="mb-1 block text-sm font-semibold">Trạng thái</span><select value={form.trangThai} onChange={(event) => setForm((current) => ({ ...current, trangThai: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">{STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block"><span className="mb-1 block text-sm font-semibold">Phản hồi của bệnh viện</span><textarea value={form.phanHoi || ""} onChange={(event) => setForm((current) => ({ ...current, phanHoi: event.target.value }))} rows={6} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Nhập nội dung trả lời bệnh nhân..." /></label><div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2 font-bold text-white disabled:bg-slate-400">{saving ? "Đang lưu..." : "Lưu xử lý"}</button></div></form></div></div>}
    </div>
  );
}

export default ManagePhanHoiPage;
