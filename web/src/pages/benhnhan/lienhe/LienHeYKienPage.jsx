import React, { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  createPhanHoi,
  getPhanHoiByBenhNhan,
} from "../../../services/phanhoi/phanhoiService";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../../utils/apiResponse";

const EMPTY_FORM = Object.freeze({
  tieuDe: "",
  noiDung: "",
  loai: "PHAN_HOI",
});

function LienHeYKienPage() {
  const patientId = localStorage.getItem("maBN") || "";
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async ({ silent = false } = {}) => {
    if (!patientId) {
      setLoading(false);
      setItems([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await getPhanHoiByBenhNhan(patientId);
      setItems(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải lịch sử phản hồi"));
      if (!silent) setItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!patientId) {
      toast.error("Tài khoản chưa được liên kết với hồ sơ bệnh nhân");
      return;
    }
    if (!form.noiDung.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi");
      return;
    }

    setSubmitting(true);
    try {
      const response = await createPhanHoi({
        ...form,
        maBN: patientId,
        tieuDe: form.tieuDe.trim(),
        noiDung: form.noiDung.trim(),
      });
      const created = unwrapApiResponse(response, null);
      if (created) setItems((current) => [created, ...current]);
      setForm({ ...EMPTY_FORM });
      toast.success("Gửi phản hồi thành công");
      await fetchItems({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể gửi phản hồi"));
    } finally {
      setSubmitting(false);
    }
  };

  const statusMeta = (status) => {
    if (status === "DA_XU_LY") return ["Đã xử lý", "bg-emerald-100 text-emerald-700", CheckCircle2];
    if (status === "DANG_XU_LY") return ["Đang xử lý", "bg-blue-100 text-blue-700", AlertCircle];
    return ["Chờ xử lý", "bg-amber-100 text-amber-700", Clock3];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-4 text-white shadow-lg"><MessageSquare size={32} /></div><div><h1 className="text-3xl font-black text-slate-900">Liên hệ và ý kiến</h1><p className="mt-1 text-slate-500">Gửi phản hồi và theo dõi câu trả lời từ bệnh viện.</p></div></div><button type="button" onClick={() => fetchItems()} className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-semibold text-slate-700"><RefreshCw size={17} /> Làm mới</button></div>

        {!patientId && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">Tài khoản chưa có mã bệnh nhân. Hãy mở trang Thông tin cá nhân để đồng bộ hồ sơ trước khi gửi phản hồi.</div>}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><Send size={22} className="text-blue-600" /> Gửi phản hồi mới</h2><label className="block"><span className="mb-1 block text-sm font-semibold">Tiêu đề</span><input value={form.tieuDe} onChange={(event) => setForm((current) => ({ ...current, tieuDe: event.target.value }))} placeholder="Ví dụ: Góp ý về dịch vụ khám bệnh" className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><label className="block"><span className="mb-1 block text-sm font-semibold">Loại phản hồi</span><select value={form.loai} onChange={(event) => setForm((current) => ({ ...current, loai: event.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-3"><option value="PHAN_HOI">Phản hồi</option><option value="CAU_HOI">Câu hỏi</option><option value="GOI_Y">Góp ý</option><option value="KHAC">Khác</option></select></label><label className="block"><span className="mb-1 block text-sm font-semibold">Nội dung *</span><textarea value={form.noiDung} onChange={(event) => setForm((current) => ({ ...current, noiDung: event.target.value }))} rows={7} required className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><button type="submit" disabled={submitting || !patientId} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700 disabled:bg-slate-400"><Send size={18} />{submitting ? "Đang gửi..." : "Gửi phản hồi"}</button></form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-xl font-black text-slate-900">Lịch sử phản hồi ({items.length})</h2>{loading ? <div className="p-10 text-center text-slate-500">Đang tải...</div> : items.length === 0 ? <div className="p-10 text-center text-slate-500"><MessageSquare className="mx-auto mb-3 text-slate-300" size={48} />Chưa có phản hồi nào.</div> : <div className="max-h-[680px] space-y-4 overflow-y-auto pr-1">{items.map((item) => { const [label, tone, Icon] = statusMeta(item.trangThai); return <article key={item.maPH} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{item.tieuDe || "Phản hồi"}</h3><p className="mt-1 text-xs text-slate-400">{item.ngayGui ? dayjs(item.ngayGui).format("DD/MM/YYYY HH:mm") : "—"}</p></div><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}><Icon size={14} />{label}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.noiDung}</p>{item.phanHoi && <div className="mt-4 rounded-xl border-l-4 border-blue-500 bg-blue-50 p-4"><p className="font-bold text-blue-900">Phản hồi từ bệnh viện</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.phanHoi}</p>{item.ngayPhanHoi && <p className="mt-2 text-xs text-blue-500">{dayjs(item.ngayPhanHoi).format("DD/MM/YYYY HH:mm")}</p>}</div>}</article>; })}</div>}</div>
        </div>
      </div>
    </div>
  );
}

export default LienHeYKienPage;
