import React, { useEffect, useState, useMemo } from "react";
import axios from "../../api/axiosClient";
import toast from "react-hot-toast";
import {
  Link2,
  Unlink,
  Search,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Cloud,
  UserCog,
} from "lucide-react";

const ROLE_COLORS = {
  ADMIN: "bg-blue-100 text-blue-800 border-blue-200",
  BACSI: "bg-green-100 text-green-800 border-green-200",
  NHANSU: "bg-amber-100 text-amber-800 border-amber-200",
};

function CognitoLinkPage() {
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({ total: 0, linked: 0, unlinked: 0 });
  const [meta, setMeta] = useState({ cognitoConfigured: false, awsAdminAvailable: false });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const [selected, setSelected] = useState(null);
  const [cognitoEmail, setCognitoEmail] = useState("");
  const [cognitoSub, setCognitoSub] = useState("");
  const [verifyInPool, setVerifyInPool] = useState(true);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await axios.get("/auth/cognito/staff-links");
      setStaff(res.data.data || []);
      setStats(res.data.stats || { total: 0, linked: 0, unlinked: 0 });
      setMeta({
        cognitoConfigured: res.data.cognitoConfigured,
        awsAdminAvailable: res.data.awsAdminAvailable,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filtered = useMemo(() => {
    let list = staff;
    if (filter === "LINKED") list = list.filter((s) => s.linked);
    if (filter === "UNLINKED") list = list.filter((s) => !s.linked);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.tenDangNhap?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.maTK?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [staff, search, filter]);

  const openLinkModal = (row) => {
    setSelected(row);
    setCognitoEmail(row.email || "");
    setCognitoSub(row.cognitoSub || "");
    setLookupResult(null);
  };

  const closeModal = () => {
    setSelected(null);
    setCognitoEmail("");
    setCognitoSub("");
    setLookupResult(null);
  };

  const handleLookup = async () => {
    if (!cognitoEmail.trim()) {
      toast.error("Nhập email Cognito để tra cứu");
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await axios.post("/auth/cognito/lookup", { email: cognitoEmail.trim() });
      setLookupResult(res.data);
      if (res.data.found && res.data.sub) {
        setCognitoSub(res.data.sub);
      }
      if (res.data.found) toast.success("Tìm thấy user trên Cognito");
      else if (res.data.available === false) toast.error(res.data.reason);
      else toast.error("Không tìm thấy trên Cognito");
    } catch (err) {
      toast.error(err.response?.data?.message || "Tra cứu thất bại");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!selected) return;

    setSubmitLoading(true);
    try {
      const res = await axios.post("/auth/cognito/link", {
        maTK: selected.maTK,
        cognitoEmail: cognitoEmail.trim(),
        cognitoSub: cognitoSub.trim() || undefined,
        verifyInPool,
      });

      toast.success(res.data.message || "Liên kết thành công");

      if (res.data.warnings?.length) {
        res.data.warnings.forEach((w) => toast(w, { icon: "⚠️", duration: 5000 }));
      }

      closeModal();
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Liên kết thất bại");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleUnlink = async (maTK, tenDangNhap) => {
    if (!window.confirm(`Gỡ liên kết Cognito Sub của "${tenDangNhap}"?`)) return;
    try {
      await axios.delete(`/auth/cognito/link/${maTK}`);
      toast.success("Đã gỡ liên kết");
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Gỡ liên kết thất bại");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 rounded-xl shadow-lg">
              <Link2 size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
                Liên kết Cognito — Nhân viên
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Gán email AWS Cognito cho tài khoản ADMIN, BACSI, NHANSU
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium"
          >
            <RefreshCw size={16} />
            Làm mới
          </button>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-3 mt-4">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              meta.cognitoConfigured
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            <Cloud size={14} />
            Cognito {meta.cognitoConfigured ? "đã cấu hình" : "chưa cấu hình"}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
              meta.awsAdminAvailable
                ? "bg-sky-50 text-sky-700 border-sky-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            AWS Admin API {meta.awsAdminAvailable ? "sẵn sàng" : "chưa có — liên kết thủ công"}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Tổng nhân viên", value: stats.total, color: "from-blue-500 to-indigo-600" },
          { label: "Đã liên kết", value: stats.linked, color: "from-emerald-500 to-teal-600" },
          { label: "Chưa liên kết", value: stats.unlinked, color: "from-amber-500 to-orange-600" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-r ${s.color} text-white rounded-xl p-4 shadow-md`}>
            <p className="text-sm opacity-90">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm tên đăng nhập, email, mã TK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white"
          />
        </div>
        <div className="flex gap-2">
          {["ALL", "UNLINKED", "LINKED"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                filter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === "ALL" ? "Tất cả" : f === "LINKED" ? "Đã liên kết" : "Chưa liên kết"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tài khoản</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Vai trò</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Email Cognito</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cognito Sub</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nhóm yêu cầu</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Trạng thái</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.maTK} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{row.tenDangNhap}</p>
                      <p className="text-xs text-gray-400">{row.maTK}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                          ROLE_COLORS[row.maNhom] || "bg-gray-100"
                        }`}
                      >
                        {row.maNhom}
                      </span>
                      {row.loaiNS && (
                        <span className="ml-1 text-xs text-gray-500">({row.loaiNS})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.email || "—"}</td>
                    <td className="px-4 py-3">
                      <code className="text-xs text-gray-500 break-all">
                        {row.cognitoSub ? `${row.cognitoSub.slice(0, 12)}…` : "—"}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                        {row.expectedCognitoGroup}
                        {row.expectedLoaiNS && ` + loaiNS:${row.expectedLoaiNS}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.linked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                          <CheckCircle2 size={14} /> Đã liên kết
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-semibold">
                          <AlertCircle size={14} /> Chưa liên kết
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openLinkModal(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                        >
                          <Link2 size={14} />
                          {row.linked ? "Sửa" : "Liên kết"}
                        </button>
                        {row.cognitoSub && (
                          <button
                            type="button"
                            onClick={() => handleUnlink(row.maTK, row.tenDangNhap)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                          >
                            <Unlink size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hướng dẫn */}
      <div className="mt-6 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-900">
        <p className="font-bold flex items-center gap-2 mb-2">
          <Shield size={16} /> Quy trình liên kết
        </p>
        <ol className="list-decimal list-inside space-y-1 text-indigo-800/90">
          <li>Tạo user trên AWS Cognito User Pool (email làm username)</li>
          <li>Gán Cognito Group: <strong>ADMIN</strong>, <strong>BACSI</strong> hoặc <strong>NHANSU</strong></li>
          <li>NHANSU: thêm attribute <code className="text-xs">custom:loaiNS</code> = YT / XN / TN</li>
          <li>Liên kết email Cognito với tài khoản DB tại trang này</li>
          <li>Nhân viên đăng nhập tại <strong>/staff/login</strong></li>
        </ol>
      </div>

      {/* Modal liên kết */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <UserCog size={20} className="text-indigo-600" />
                Liên kết Cognito — {selected.tenDangNhap}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Vai trò DB: <strong>{selected.maNhom}</strong>
                {selected.loaiNS && ` · loaiNS: ${selected.loaiNS}`}
              </p>
            </div>

            <form onSubmit={handleLink} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email Cognito *
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={cognitoEmail}
                    onChange={(e) => setCognitoEmail(e.target.value)}
                    required
                    placeholder="nhanvien@benhvien.vn"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={lookupLoading}
                    className="px-3 py-2 rounded-lg bg-sky-100 text-sky-700 text-sm font-semibold hover:bg-sky-200 disabled:opacity-50"
                  >
                    {lookupLoading ? "..." : "Tra cứu"}
                  </button>
                </div>
              </div>

              {lookupResult?.found && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                  <p>
                    <strong>Username:</strong> {lookupResult.username}
                  </p>
                  <p>
                    <strong>Status:</strong> {lookupResult.status}
                  </p>
                  <p>
                    <strong>Groups:</strong>{" "}
                    {lookupResult.groups?.join(", ") || "(chưa gán nhóm)"}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Cognito Sub (tuỳ chọn)
                </label>
                <input
                  type="text"
                  value={cognitoSub}
                  onChange={(e) => setCognitoSub(e.target.value)}
                  placeholder="Tự điền khi tra cứu hoặc để trống"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={verifyInPool}
                  onChange={(e) => setVerifyInPool(e.target.checked)}
                  className="rounded"
                />
                Xác minh trên Cognito Pool (cần AWS credentials)
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitLoading ? "Đang lưu..." : "Lưu liên kết"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CognitoLinkPage;
