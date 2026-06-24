import React, { useEffect, useState } from "react";
import { createPhanHoi, getPhanHoiByBenhNhan } from "../../../services/phanhoi/phanhoiService";
import toast from "react-hot-toast";
import { MessageSquare, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';

const LienHeYKienPage = () => {
  const [form, setForm] = useState({ tieuDe: "", noiDung: "", loai: "PHAN_HOI" });
  const [phanHoiList, setPhanHoiList] = useState([]);
  const [loading, setLoading] = useState(false);
  const maBN = localStorage.getItem("maBN");

  useEffect(() => {
    if (maBN) {
      fetchPhanHoi();
    }
  }, [maBN]);

  const fetchPhanHoi = async () => {
    try {
      const res = await getPhanHoiByBenhNhan(maBN);
      setPhanHoiList(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải phản hồi:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.noiDung.trim()) {
      toast.error("Vui lòng nhập nội dung phản hồi");
      return;
    }

    setLoading(true);
    try {
      await createPhanHoi({ ...form, maBN });
      toast.success("Gửi phản hồi thành công!");
      setForm({ tieuDe: "", noiDung: "", loai: "PHAN_HOI" });
      fetchPhanHoi();
    } catch (err) {
      toast.error("Lỗi khi gửi phản hồi");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (trangThai) => {
    const statusMap = {
      'CHO_XU_LY': { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
      'DANG_XU_LY': { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertCircle },
      'DA_XU_LY': { label: 'Đã xử lý', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
    };
    const status = statusMap[trangThai] || { label: trangThai, color: 'bg-gray-100 text-gray-800', icon: XCircle };
    const Icon = status.icon;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${status.color}`}>
        <Icon size={14} />
        {status.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl shadow-lg">
            <MessageSquare size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Liên hệ & Ý kiến</h1>
            <p className="text-gray-600">Gửi phản hồi về chất lượng dịch vụ hoặc đặt câu hỏi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Gửi phản hồi */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow duration-300">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <Send size={28} className="text-blue-600" />
            Gửi phản hồi mới
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Tiêu đề (tùy chọn)</label>
              <input
                type="text"
                value={form.tieuDe}
                onChange={(e) => setForm({ ...form, tieuDe: e.target.value })}
                placeholder="VD: Phản hồi về dịch vụ khám bệnh"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Loại phản hồi</label>
              <select
                value={form.loai}
                onChange={(e) => setForm({ ...form, loai: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 bg-white"
              >
                <option value="PHAN_HOI">Phản hồi</option>
                <option value="CAU_HOI">Câu hỏi</option>
                <option value="GOI_Y">Góp ý</option>
                <option value="KHAC">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nội dung *</label>
              <textarea
                value={form.noiDung}
                onChange={(e) => setForm({ ...form, noiDung: e.target.value })}
                placeholder="Nhập nội dung phản hồi của bạn..."
                rows={5}
                required
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Send size={20} />
              {loading ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </form>
        </div>

        {/* Danh sách phản hồi */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 flex flex-col h-full">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <MessageSquare size={28} className="text-blue-600" />
            Lịch sử phản hồi ({phanHoiList.length})
          </h2>
          <div className="space-y-5 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent flex-1" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {phanHoiList.length === 0 ? (
              <div className="text-center py-16 flex flex-col items-center justify-center h-full">
                <div className="bg-blue-50 p-6 rounded-full mb-4">
                  <MessageSquare size={48} className="text-blue-300" />
                </div>
                <p className="text-gray-500 font-medium text-lg">Chưa có phản hồi nào</p>
                <p className="text-gray-400 text-sm mt-1">Các phản hồi hệ thống ghi nhận sẽ nằm ở đây.</p>
              </div>
            ) : (
              phanHoiList.map((ph) => (
                <div key={ph.maPH} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-start justify-between mb-3 border-b border-gray-100 pb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-lg leading-tight">{ph.tieuDe || "Phản hồi thông thường"}</h3>
                      <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                        <Clock size={12} />
                        {dayjs(ph.ngayGui).format("DD/MM/YYYY HH:mm")}
                      </p>
                    </div>
                    <div>{getStatusBadge(ph.trangThai)}</div>
                  </div>
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed">{ph.noiDung}</p>
                  {ph.phanHoi && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-inner mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle size={16} className="text-blue-600" />
                        <p className="text-sm font-bold text-blue-900">Phản hồi từ bệnh viện</p>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-6">{ph.phanHoi}</p>
                      {ph.ngayPhanHoi && (
                        <p className="text-xs text-blue-400 mt-3 pl-6 font-medium">
                          Đã trả lời lúc: {dayjs(ph.ngayPhanHoi).format("DD/MM/YYYY HH:mm")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LienHeYKienPage;

