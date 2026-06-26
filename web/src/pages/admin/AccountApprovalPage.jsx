import React, { useEffect, useState, useMemo } from "react";
import axios from "../../api/axiosClient";
import toast from "react-hot-toast";
import {
  UserCheck,
  UserX,
  RefreshCw,
  Clock,
  Mail,
  Shield,
  AlertTriangle,
} from "lucide-react";

const ROLE_BADGE = {
  ADMIN: "bg-blue-100 text-blue-800",
  BACSI: "bg-green-100 text-green-800",
  NHANSU: "bg-amber-100 text-amber-800",
  BENHNHAN: "bg-purple-100 text-purple-800",
};

function AccountApprovalPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [showExpired, setShowExpired] = useState(true);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/auth/registrations/pending", {
        params: { includeExpired: showExpired },
      });
      setList(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Không tải được danh sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, [showExpired]);

  const activeCount = useMemo(() => list.filter((r) => !r.isExpired).length, [list]);

  const handleApprove = async (id, tenDangNhap) => {
    if (!window.confirm(`Duyệt đăng ký "${tenDangNhap}" và tạo tài khoản?`)) return;
    setProcessingId(id);
    try {
      const res = await axios.post(`/auth/registrations/${id}/approve`);
      toast.success(res.data.message || "Đã duyệt thành công");
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Duyệt thất bại");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setProcessingId(rejectModal.id);
    try {
      const res = await axios.post(`/auth/registrations/${rejectModal.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      toast.success(res.data.message || "Đã từ chối");
      setRejectModal(null);
      setRejectReason("");
      fetchPending();
    } catch (err) {
      toast.error(err.response?.data?.message || "Từ chối thất bại");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg">
            <UserCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Duyệt đăng ký tài khoản</h1>
            <p className="text-sm text-gray-500">
              Yêu cầu đăng ký chờ xử lý (OTP / đăng ký bệnh nhân)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="rounded"
            />
            Hiện OTP hết hạn
          </label>
          <button
            type="button"
            onClick={fetchPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white text-sm font-medium hover:bg-gray-50"
          >
            <RefreshCw size={16} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-500">Tổng chờ duyệt</p>
          <p className="text-2xl font-bold text-gray-800">{list.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-500">Còn hiệu lực OTP</p>
          <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <p className="text-sm text-gray-500">Hết hạn</p>
          <p className="text-2xl font-bold text-amber-600">{list.length - activeCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin h-10 w-10 border-4 border-violet-500 border-t-transparent rounded-full" />
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <UserCheck size={48} className="mx-auto mb-3 opacity-40" />
            <p>Không có yêu cầu đăng ký chờ duyệt</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Người đăng ký</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Vai trò</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Thời gian</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">OTP</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-violet-50/40 ${row.isExpired ? "opacity-70" : ""}`}
                  >
                    <td className="px-4 py-3 font-semibold text-gray-800">{row.tenDangNhap}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-gray-600">
                        <Mail size={14} /> {row.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                          ROLE_BADGE[row.maNhom] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <Shield size={12} /> {row.maNhom}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <p>Gửi: {formatDate(row.createdAt)}</p>
                      <p className="flex items-center gap-1 mt-0.5">
                        <Clock size={12} /> Hết hạn: {formatDate(row.expiredAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold">
                          <AlertTriangle size={14} /> Hết hạn
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">Còn hiệu lực</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          disabled={processingId === row.id}
                          onClick={() => handleApprove(row.id, row.tenDangNhap)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <UserCheck size={14} />
                          Duyệt
                        </button>
                        <button
                          type="button"
                          disabled={processingId === row.id}
                          onClick={() => {
                            setRejectModal(row);
                            setRejectReason("");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                        >
                          <UserX size={14} />
                          Từ chối
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

      <p className="mt-4 text-xs text-gray-400">
        * Duyệt sẽ tạo tài khoản chính thức ngay (bỏ qua bước OTP của user). Từ chối sẽ xóa yêu cầu
        đăng ký tạm.
      </p>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Từ chối đăng ký</h3>
            <p className="text-sm text-gray-500 mb-4">
              Tài khoản: <strong>{rejectModal.tenDangNhap}</strong> ({rejectModal.email})
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Lý do từ chối (tuỳ chọn)..."
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="flex-1 py-2 border rounded-lg text-gray-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountApprovalPage;
