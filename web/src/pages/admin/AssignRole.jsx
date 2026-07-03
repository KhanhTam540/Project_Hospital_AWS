import React, { useCallback, useEffect, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import toast from "react-hot-toast";
import { RefreshCw, Save, ShieldCheck } from "lucide-react";
import axios from "../../api/axiosClient";
import {
  ensureArray,
  ensureObject,
  getApiErrorMessage,
  unwrapApiResponse,
} from "../../utils/apiResponse";

const SYSTEM_ROLES = ["ADMIN", "BACSI", "NHANSU", "BENHNHAN"];

const normalizeAccount = (item = {}) => ({
  username: item.username || item.tenDangNhap || item.id || "",
  maTK: item.maTK || item.appUserId || item.id || item.username || "",
  tenDangNhap: item.tenDangNhap || item.username || "",
  email: item.email || "",
  maNhom: item.maNhom || item.primaryRole || item.groups?.[0] || "BENHNHAN",
});

function AssignRole() {
  const [users, setUsers] = useState([]);
  const [updatedRoles, setUpdatedRoles] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingUsername, setSavingUsername] = useState("");
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

      const normalized = list.map(normalizeAccount);
      setUsers(normalized);
      setUpdatedRoles(
        Object.fromEntries(
          normalized.map((user) => [user.username, user.maNhom]),
        ),
      );
    } catch (requestError) {
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

  const pagination = useAdminPagination(users, {
    initialPageSize: 10,
    resetKey: String(users.length),
  });

  const handleChange = (username, role) => {
    setUpdatedRoles((current) => ({ ...current, [username]: role }));
  };

  const handleSave = async (user) => {
    const username = user.username;
    const maNhom = updatedRoles[username];

    if (!username || !SYSTEM_ROLES.includes(maNhom)) {
      toast.error("Tên đăng nhập hoặc vai trò không hợp lệ");
      return;
    }

    setSavingUsername(username);

    try {
      await axios.put(`/tai-khoan/${encodeURIComponent(username)}`, {
        maNhom,
      });
      toast.success("Cập nhật quyền thành công");
      await fetchUsers();
    } catch (requestError) {
      toast.error(
        getApiErrorMessage(requestError, "Không thể cập nhật quyền"),
      );
    } finally {
      setSavingUsername("");
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-blue-700 flex items-center gap-2">
            <ShieldCheck size={26} />
            Phân quyền người dùng
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Mỗi tài khoản được gán một nhóm Cognito chính.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 border rounded-lg px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border text-sm text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3">Tên đăng nhập</th>
              <th className="p-3">Email</th>
              <th className="p-3">Quyền hiện tại</th>
              <th className="p-3">Gán quyền mới</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-gray-500">
                  Đang tải tài khoản...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center italic text-gray-500">
                  Không có tài khoản nào
                </td>
              </tr>
            ) : (
              pagination.pageItems.map((user) => {
                const nextRole = updatedRoles[user.username] || user.maNhom;
                const changed = nextRole !== user.maNhom;
                const saving = savingUsername === user.username;

                return (
                  <tr key={user.username} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-semibold text-gray-800">
                        {user.tenDangNhap || user.username}
                      </div>
                      <div className="text-xs text-gray-400">{user.maTK}</div>
                    </td>
                    <td className="p-3">
                      {user.email || <i className="text-gray-400">Chưa có</i>}
                    </td>
                    <td className="p-3 font-semibold">{user.maNhom}</td>
                    <td className="p-3">
                      <select
                        value={nextRole}
                        onChange={(event) =>
                          handleChange(user.username, event.target.value)
                        }
                        className="border p-2 rounded-lg min-w-40"
                      >
                        {SYSTEM_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => handleSave(user)}
                        disabled={!changed || saving}
                        className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Save size={16} />
                        {saving ? "Đang lưu..." : "Lưu"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && users.length > 0 && (
        <AdminPagination pagination={pagination} itemLabel="tài khoản" className="mt-4 rounded-xl border border-slate-200" />
      )}
    </div>
  );
}

export default AssignRole;
