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
  maXN: "",
  maLoaiXN: "",
  tenXN: "",
  moTa: "",
  chiPhi: "",
  thoiGianTraKetQua: "",
  donVi: "Lần",
  trangThai: 1,
});

function ManageXetNghiem() {
  const [tests, setTests] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [testResponse, typeResponse] = await Promise.all([
        axios.get("/xetnghiem"),
        axios.get("/loaixetnghiem"),
      ]);
      setTests(ensureArray(unwrapApiResponse(testResponse, [])));
      setTypes(ensureArray(unwrapApiResponse(typeResponse, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải danh mục xét nghiệm"));
      if (!silent) {
        setTests([]);
        setTypes([]);
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
    if (!keyword) return tests;
    return tests.filter((item) =>
      [item.maXN, item.tenXN, item.LoaiXetNghiem?.tenLoai, item.moTa]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [search, tests]);

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
    if (!form.tenXN.trim() || !form.maLoaiXN || form.chiPhi === "") {
      toast.error("Tên xét nghiệm, loại và chi phí là bắt buộc");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        tenXN: form.tenXN.trim(),
        moTa: form.moTa.trim(),
        chiPhi: Number(form.chiPhi),
        thoiGianTraKetQua: form.thoiGianTraKetQua.trim(),
        donVi: form.donVi.trim() || "Lần",
      };

      if (form.maXN) {
        const response = await axios.put(`/xetnghiem/${encodeURIComponent(form.maXN)}`, payload);
        const updated = unwrapApiResponse(response, payload);
        setTests((current) => current.map((item) => item.maXN === form.maXN ? updated : item));
        toast.success("Cập nhật xét nghiệm thành công");
      } else {
        const response = await axios.post("/xetnghiem", payload);
        const created = unwrapApiResponse(response, payload);
        setTests((current) => [created, ...current]);
        toast.success("Thêm xét nghiệm thành công");
      }

      setForm(null);
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể lưu xét nghiệm"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Xóa xét nghiệm “${item.tenXN}”?`)) return;
    setDeletingId(item.maXN);
    try {
      await axios.delete(`/xetnghiem/${encodeURIComponent(item.maXN)}`);
      setTests((current) => current.filter((row) => row.maXN !== item.maXN));
      toast.success("Đã xóa xét nghiệm");
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Không thể xóa. Xét nghiệm có thể đang được sử dụng.",
        ),
      );
    } finally {
      setDeletingId("");
    }
  };

  const money = (value) => new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-600">Dịch vụ cận lâm sàng</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Quản lý xét nghiệm</h1>
          <p className="mt-1 text-sm text-slate-500">Danh mục xét nghiệm và loại xét nghiệm lấy từ DynamoDB.</p>
        </div>
        <div className="flex gap-2"><button type="button" onClick={() => fetchData()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold"><RefreshCw size={17} /> Làm mới</button><button type="button" onClick={() => setForm({ ...EMPTY_FORM, maLoaiXN: types[0]?.maLoaiXN || "" })} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 font-bold text-white hover:bg-cyan-700"><Plus size={18} /> Thêm xét nghiệm</button></div>
      </div>

      <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã, tên hoặc loại xét nghiệm..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100" /></div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-12 text-center text-slate-500">Đang tải xét nghiệm...</div> : filtered.length === 0 ? <div className="p-12 text-center text-slate-500"><FlaskConical className="mx-auto mb-3 text-slate-300" size={48} />Chưa có xét nghiệm.</div> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left text-slate-600"><tr><th className="px-5 py-4">Mã</th><th className="px-5 py-4">Tên xét nghiệm</th><th className="px-5 py-4">Loại</th><th className="px-5 py-4">Chi phí</th><th className="px-5 py-4">Trả kết quả</th><th className="px-5 py-4">Trạng thái</th><th className="px-5 py-4 text-center">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{pagination.pageItems.map((item) => <tr key={item.maXN} className="hover:bg-cyan-50/40"><td className="px-5 py-4 font-mono text-xs text-slate-500">{item.maXN}</td><td className="px-5 py-4 font-bold text-slate-900">{item.tenXN}</td><td className="px-5 py-4 text-slate-600">{item.LoaiXetNghiem?.tenLoai || item.maLoaiXN}</td><td className="px-5 py-4 font-semibold text-slate-700">{money(item.chiPhi)}</td><td className="px-5 py-4 text-slate-600">{item.thoiGianTraKetQua || "—"}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${Number(item.trangThai) === 0 ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{Number(item.trangThai) === 0 ? "Ngừng dùng" : "Đang dùng"}</span></td><td className="px-5 py-4"><div className="flex justify-center gap-2"><button type="button" onClick={() => setForm({ ...EMPTY_FORM, ...item })} className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"><Edit3 size={18} /></button><button type="button" onClick={() => handleDelete(item)} disabled={deletingId === item.maXN} className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-50"><Trash2 size={18} /></button></div></td></tr>)}</tbody></table></div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="xét nghiệm" />
        </div>
      )}

      {form && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><h2 className="text-xl font-black">{form.maXN ? "Cập nhật xét nghiệm" : "Thêm xét nghiệm"}</h2><button type="button" onClick={() => !saving && setForm(null)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20} /></button></div><form onSubmit={handleSubmit} className="grid gap-4 p-5 md:grid-cols-2"><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Tên xét nghiệm *</span><input name="tenXN" value={form.tenXN} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label><span className="mb-1 block text-sm font-semibold">Loại xét nghiệm *</span><select name="maLoaiXN" value={form.maLoaiXN} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="">-- Chọn loại --</option>{types.map((item) => <option key={item.maLoaiXN} value={item.maLoaiXN}>{item.tenLoai}</option>)}</select></label><label><span className="mb-1 block text-sm font-semibold">Chi phí *</span><input type="number" min="0" name="chiPhi" value={form.chiPhi} onChange={handleChange} required className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label><span className="mb-1 block text-sm font-semibold">Thời gian trả kết quả</span><input name="thoiGianTraKetQua" value={form.thoiGianTraKetQua} onChange={handleChange} placeholder="Ví dụ: 2 giờ" className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label><span className="mb-1 block text-sm font-semibold">Đơn vị</span><input name="donVi" value={form.donVi} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold">Mô tả</span><textarea name="moTa" value={form.moTa} onChange={handleChange} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><label><span className="mb-1 block text-sm font-semibold">Trạng thái</span><select name="trangThai" value={form.trangThai} onChange={handleChange} className="w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value={1}>Đang sử dụng</option><option value={0}>Ngừng sử dụng</option></select></label><div className="flex justify-end gap-3 border-t pt-4 md:col-span-2"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 font-semibold">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-cyan-600 px-5 py-2 font-bold text-white disabled:bg-slate-400">{saving ? "Đang lưu..." : "Lưu xét nghiệm"}</button></div></form></div></div>}
    </div>
  );
}

export default ManageXetNghiem;
