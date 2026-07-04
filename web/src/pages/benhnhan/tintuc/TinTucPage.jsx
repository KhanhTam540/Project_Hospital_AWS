import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { ArrowRight, Calendar, Eye, Newspaper, Search, X } from "lucide-react";
import {
  getPublicOneTinTuc,
  getPublicTinTuc,
} from "../../../services/tintuc/tintucService";
import {
  ensureArray,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../../utils/apiResponse";

function TinTucPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getPublicTinTuc({ limit: 50 });
      setItems(ensureArray(unwrapApiResponse(response, [])));
    } catch (error) {
      setItems([]);
      toast.error(getApiErrorMessage(error, "Không thể tải tin tức"));
    } finally {
      setLoading(false);
    }
  }, []);

  const viewDetail = useCallback(async (newsId, { updateUrl = true } = {}) => {
    if (!newsId) return;
    setDetailLoading(true);
    try {
      const response = await getPublicOneTinTuc(newsId);
      setSelected(unwrapApiResponse(response, null));
      if (updateUrl) setSearchParams({ maTin: newsId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tải chi tiết tin tức"));
    } finally {
      setDetailLoading(false);
    }
  }, [setSearchParams]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const newsId = searchParams.get("maTin");
    if (newsId) viewDetail(newsId, { updateUrl: false });
  }, [searchParams, viewDetail]);

  const closeDetail = () => {
    setSelected(null);
    setSearchParams({});
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) =>
      [item.tieuDe, item.tomTat, item.noiDung, item.loai]
        .some((value) => String(value || "").toLowerCase().includes(keyword)),
    );
  }, [items, search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-green-600 to-emerald-600 p-4 text-white shadow-lg"><Newspaper size={32} /></div>
          <div><h1 className="text-3xl font-black text-slate-900">Tin tức và thông báo</h1><p className="mt-1 text-slate-500">Thông tin được xuất bản trực tiếp từ hệ thống bệnh viện.</p></div>
        </div>

        <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm tin tức..." className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" /></div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-96 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-sm"><Newspaper className="mx-auto mb-3 text-slate-300" size={56} /><h2 className="text-lg font-bold text-slate-700">Chưa có tin tức phù hợp</h2></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.maTin} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                {item.hinhAnh ? <img src={item.hinhAnh} alt={item.tieuDe} className="h-52 w-full object-cover" /> : <div className="flex h-52 items-center justify-center bg-slate-100 text-slate-300"><Newspaper size={56} /></div>}
                <div className="p-5"><div className="mb-3 flex items-center gap-4 text-xs text-slate-400"><span className="inline-flex items-center gap-1"><Calendar size={14} />{item.ngayDang ? dayjs(item.ngayDang).format("DD/MM/YYYY") : "—"}</span><span className="inline-flex items-center gap-1"><Eye size={14} />{item.luotXem || 0}</span></div><h2 className="line-clamp-2 text-lg font-black text-slate-900">{item.tieuDe}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-500">{item.tomTat || "Xem nội dung chi tiết của tin tức bệnh viện."}</p><button type="button" onClick={() => viewDetail(item.maTin)} className="mt-4 inline-flex items-center gap-2 font-bold text-emerald-700 hover:text-emerald-800">Đọc chi tiết <ArrowRight size={16} /></button></div>
              </article>
            ))}
          </div>
        )}
      </div>

      {(selected || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5"><h2 className="pr-6 text-xl font-black text-slate-900">{selected?.tieuDe || "Đang tải tin tức..."}</h2><button type="button" onClick={closeDetail} className="rounded-lg p-2 hover:bg-slate-100"><X size={21} /></button></div>
            {detailLoading && !selected ? <div className="p-16 text-center text-slate-500">Đang tải...</div> : selected && <div className="p-6">{selected.hinhAnh && <img src={selected.hinhAnh} alt={selected.tieuDe} className="mb-6 max-h-[440px] w-full rounded-xl object-cover" />}<div className="mb-5 flex flex-wrap gap-4 text-sm text-slate-400"><span className="inline-flex items-center gap-1"><Calendar size={16} />{selected.ngayDang ? dayjs(selected.ngayDang).format("DD/MM/YYYY HH:mm") : "—"}</span><span className="inline-flex items-center gap-1"><Eye size={16} />{selected.luotXem || 0} lượt xem</span></div>{selected.tomTat && <p className="mb-6 rounded-xl bg-emerald-50 p-4 text-lg font-semibold leading-7 text-emerald-900">{selected.tomTat}</p>}<div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: selected.noiDung || "" }} /></div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default TinTucPage;
