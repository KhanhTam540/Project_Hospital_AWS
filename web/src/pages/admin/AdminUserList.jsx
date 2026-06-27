import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Activity,
  Edit,
  Lock,
  RefreshCw,
  Search,
  Shield,
  Stethoscope,
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

const ROLE_LABELS = {
  ADMIN: "Admin",
  BACSI: "Bác sĩ",
  NHANSU: "Nhân sự",
  BENHNHAN: "Bệnh nhân",
};

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
});

function AdminUserList() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("ALL");
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDisable = async (user) => {
    const username = user.username || user.tenDangNhap;
    if (!username) {
      toast.error("Không xác định được Cognito username");
      return;
    }

    if (!window.confirm(`Khóa tài khoản ${username}?`)) {
      return;
    }

    try {
      await axios.delete(`/tai-khoan/${encodeURIComponent(username)}`);
      toast.success("Đã khóa tài khoản");
      await fetchUsers();
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(requestError, "Không thể khóa tài khoản"),
      );
    }
  };

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesKeyword =
        !keyword ||
        user.tenDangNhap.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        user.maTK.toLowerCase().includes(keyword);

      const matchesRole =
        activeTab === "ALL" || user.maNhom === activeTab;

      return matchesKeyword && matchesRole;
    });
  }, [users, search, activeTab]);

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
        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
          colors[role] || "bg-gray-100 text-gray-800 border-gray-200"
        }`}
      >
        {ROLE_LABELS[role] || role || "Chưa gán"}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6">
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-xl shadow-lg">
              <Users size={32} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Quản lý tài khoản
              </h1>
              <p className="text-gray-600">
                Dữ liệu lấy trực tiếp từ Amazon Cognito
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={fetchUsers}
              disabled={loading}
              className="bg-white text-gray-700 border border-gray-200 px-4 py-3 rounded-lg font-semibold hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Làm mới
            </button>
            <Link
              to="/admin/taikhoan/tao-moi"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-md flex items-center gap-2"
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
            placeholder="Tìm theo mã, tên đăng nhập hoặc email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
                selected
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Icon size={18} />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
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
        <div className="flex items-center justify-center min-h-[320px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4" />
            <p className="text-gray-600">Đang tải dữ liệu...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Users size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Không có tài khoản phù hợp
          </h3>
          <p className="text-gray-500">
            Kiểm tra từ khóa tìm kiếm hoặc bộ lọc vai trò.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Mã TK</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Tên đăng nhập</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Vai trò</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Trạng thái</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Liên kết hồ sơ</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((user) => (
                  <tr
                    key={user.username || user.maTK}
                    className="hover:bg-blue-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-gray-800">{user.maTK || "-"}</td>
                    <td className="px-6 py-4 text-gray-700">{user.tenDangNhap || "-"}</td>
                    <td className="px-6 py-4 text-gray-700">{user.email || "-"}</td>
                    <td className="px-6 py-4">{getRoleBadge(user.maNhom)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                          user.enabled
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }`}
                      >
                        {user.enabled ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-xs">
                      {user.maBS && <div>Bác sĩ: {user.maBS}</div>}
                      {user.maNS && <div>Nhân sự: {user.maNS}</div>}
                      {user.maBN && <div>Bệnh nhân: {user.maBN}</div>}
                      {!user.maBS && !user.maNS && !user.maBN && <span>-</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          to="/admin/taikhoan/phan-quyen"
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                          title="Phân quyền"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDisable(user)}
                          disabled={!user.enabled}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg disabled:opacity-40"
                          title="Khóa tài khoản"
                        >
                          <Lock size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUserList;
