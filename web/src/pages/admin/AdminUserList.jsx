import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  Edit3,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Stethoscope,
  Unlock,
  UserPlus,
  Users,
} from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  ensureObject,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const ROLE_LABELS = Object.freeze({
  ADMIN: "Quản trị viên",
  BACSI: "Bác sĩ",
  NHANSU: "Nhân viên y tế",
  BENHNHAN: "Bệnh nhân",
});

const normalizeAccount = (item = {}) => ({
  maTK: item.maTK || item.appUserId || item.id || item.username || "",
  username: item.username || item.tenDangNhap || item.id || "",
  tenDangNhap: item.tenDangNhap || item.username || "",
  email: item.email || "",
  maNhom: item.maNhom || item.primaryRole || item.groups?.[0] || "",
  groups: ensureArray(item.groups),
  trangThai: item.trangThai ?? (item.enabled === false ? 0 : 1),
  enabled: item.enabled !== false,
  confirmationStatus: item.confirmationStatus || "",
  maBS: item.maBS || item.doctorId || "",
  maNS: item.maNS || item.staffId || "",
  maBN: item.maBN || item.patientId || "",
  hoTen: item.hoTen || item.fullName || "",
  maKhoa: item.maKhoa || item.departmentId || "",
  tenKhoa: item.tenKhoa || "",
  loaiNS: item.loaiNS || item.staffType || "",
  chuyenMon: item.chuyenMon || item.specialty || "",
  capBac: item.capBac || item.rank || "",
  trinhDo: item.trinhDo || item.degree || "",
  chucVu: item.chucVu || item.position || "",
  soDienThoai: item.soDienThoai || item.phoneNumber || "",
  ngaySinh: item.ngaySinh || item.birthDate || "",
  gioiTinh: item.gioiTinh || item.gender || "",
  diaChi: item.diaChi || item.address || "",
  bhyt: item.bhyt || item.healthInsurance || "",
});

function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [error, setError] = useState("");
  const [processingUsername, setProcessingUsername] = useState("");

  const fetchUsers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const response = await axios.get("/tai-khoan");
      const rawPayload = unwrapApiResponse(response, {});
      const payload = ensureObject(rawPayload);
      const list = Array.isArray(rawPayload)
        ? rawPayload
        : ensureArray(payload.users || payload.items);

      setUsers(list.map(normalizeAccount));
    } catch (requestError) {
      console.error("Không tải được tài khoản", requestError);
      const message = getApiErrorMessage(
        requestError,
        "Không thể tải danh sách tài khoản",
      );
      setUsers([]);
      setError(message);
      toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDisable = async (user) => {
    const username = user.username || user.tenDangNhap;
    if (!username) {
      toast.error("Không xác định được tên đăng nhập");
      return;
    }

    if (!window.confirm(`Khóa tài khoản ${username}?`)) return;

    setProcessingUsername(username);
    try {
      await axios.delete(`/tai-khoan/${encodeURIComponent(username)}`);
      setUsers((current) =>
        current.map((item) =>
          item.username === username
            ? { ...item, enabled: false, trangThai: 0 }
            : item,
        ),
      );
      toast.success("Đã khóa tài khoản");
      await fetchUsers({ silent: true });
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(requestError, "Không thể khóa tài khoản"),
      );
    } finally {
      setProcessingUsername("");
    }
  };

  const handleEnable = async (user) => {
    const username = user.username || user.tenDangNhap;
    if (!username) {
      toast.error("Không xác định được tên đăng nhập");
      return;
    }

    setProcessingUsername(username);
    try {
      await axios.post(
        `/tai-khoan/${encodeURIComponent(username)}/enable`,
      );
      setUsers((current) =>
        current.map((item) =>
          item.username === username
            ? { ...item, enabled: true, trangThai: 1 }
            : item,
        ),
      );
      toast.success("Đã kích hoạt tài khoản");
      await fetchUsers({ silent: true });
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(requestError, "Không thể kích hoạt tài khoản"),
      );
    } finally {
      setProcessingUsername("");
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesKeyword =
        !keyword ||
        user.tenDangNhap.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.maTK.toLowerCase().includes(keyword) ||
        user.hoTen.toLowerCase().includes(keyword);

      const matchesRole = activeTab === "ALL" || user.maNhom === activeTab;
      return matchesKeyword && matchesRole;
    });
  }, [users, search, activeTab]);

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: `${search}|${activeTab}`,
  });

  const grouped = useMemo(
    () => ({
      ADMIN: users.filter((user) => user.maNhom === "ADMIN").length,
      BACSI: users.filter((user) => user.maNhom === "BACSI").length,
      NHANSU: users.filter((user) => user.maNhom === "NHANSU").length,
      BENHNHAN: users.filter((user) => user.maNhom === "BENHNHAN").length,
    }),
    [users],
  );

  const tabs = [
    { id: "ALL", label: "Tất cả", count: users.length, icon: Users },
    { id: "ADMIN", label: "Admin", count: grouped.ADMIN, icon: Shield },
    { id: "BACSI", label: "Bác sĩ", count: grouped.BACSI, icon: Stethoscope },
    { id: "NHANSU", label: "Nhân sự", count: grouped.NHANSU, icon: Activity },
    { id: "BENHNHAN", label: "Bệnh nhân", count: grouped.BENHNHAN, icon: Users },
  ];

  const getRoleBadge = (role) => {
    const colors = {
      ADMIN: "bg-blue-100 text-blue-800 border-blue-200",
      BACSI: "bg-green-100 text-green-800 border-green-200",
      NHANSU: "bg-yellow-100 text-yellow-800 border-yellow-200",
      BENHNHAN: "bg-purple-100 text-purple-800 border-purple-200",
    };

    return (
      <span
        className={`rounded-full border px-2 py-1 text-xs font-semibold ${
          colors[role] || "border-gray-200 bg-gray-100 text-gray-800"
        }`}
      >
        {ROLE_LABELS[role] || role || "Chưa gán"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shadow-lg">
              <Users size={32} className="text-white" />
            </div>
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-800">
                Quản lý tài khoản
              </h1>
              <p className="text-gray-600">
                Tạo, chỉnh sửa, phân quyền, khóa và kích hoạt tài khoản.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchUsers()}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
            <Link
              to="/admin/taikhoan/tao-moi"
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-md hover:from-blue-700 hover:to-indigo-700"
            >
              <UserPlus size={20} />
              Tạo tài khoản
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Tìm theo mã, họ tên, tên đăng nhập hoặc email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-12 pr-4 shadow-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition ${
                selected
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} />
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selected ? "bg-white/20" : "bg-gray-100"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-b-4 border-t-4 border-blue-600" />
            <p className="text-gray-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-white p-12 text-center shadow-md">
          <Users size={64} className="mx-auto mb-4 text-gray-300" />
          <h3 className="mb-2 text-xl font-semibold text-gray-700">
            Không có tài khoản phù hợp
          </h3>
          <p className="text-gray-500">
            Kiểm tra từ khóa tìm kiếm hoặc bộ lọc vai trò.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Tài khoản</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Vai trò</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Xác nhận</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Hồ sơ</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagination.pageItems.map((user) => {
                  const username = user.username || user.tenDangNhap;
                  const processing = processingUsername === username;
                  return (
                    <tr key={username || user.maTK} className="transition-colors hover:bg-blue-50">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800">{user.hoTen || username || "-"}</p>
                        <p className="mt-1 text-xs text-gray-500">{username || "-"}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-gray-400">{user.maTK || "-"}</p>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{user.email || "-"}</td>
                      <td className="px-6 py-4">{getRoleBadge(user.maNhom)}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          user.confirmationStatus === "CONFIRMED"
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : "border-amber-200 bg-amber-100 text-amber-800"
                        }`}>
                          {user.confirmationStatus || "Không xác định"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          user.enabled
                            ? "border-green-200 bg-green-100 text-green-800"
                            : "border-red-200 bg-red-100 text-red-800"
                        }`}>
                          {user.enabled ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600">
                        {user.maBS && <div>Bác sĩ: {user.maBS}</div>}
                        {user.maNS && <div>Nhân sự: {user.maNS}</div>}
                        {user.maBN && <div>Bệnh nhân: {user.maBN}</div>}
                        {!user.maBS && !user.maNS && !user.maBN && <span>-</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`/admin/taikhoan/sua/${encodeURIComponent(username)}`}
                            state={{ user }}
                            className="rounded-lg p-2 text-blue-600 hover:bg-blue-100"
                            title="Chỉnh sửa tài khoản"
                          >
                            <Edit3 size={18} />
                          </Link>
                          {user.enabled ? (
                            <button
                              type="button"
                              onClick={() => handleDisable(user)}
                              disabled={processing}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-100 disabled:opacity-40"
                              title="Khóa tài khoản"
                            >
                              <Lock size={18} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEnable(user)}
                              disabled={processing}
                              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40"
                              title="Kích hoạt tài khoản"
                            >
                              <Unlock size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination pagination={pagination} itemLabel="tài khoản" />
        </div>
      )}
    </div>
  );
}

export default AdminUserList;
