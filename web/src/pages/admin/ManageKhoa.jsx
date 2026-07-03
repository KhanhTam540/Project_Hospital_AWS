import React, { useEffect, useState } from "react";
import AdminPagination, { useAdminPagination } from "../../components/admin/AdminPagination";
import axios from "../../api/axiosClient";
import toast from "react-hot-toast";
import { Building2, Search, Edit, Trash2, Plus, X, Save } from 'lucide-react';

const ManageKhoa = ({ embedded = false }) => {
  const [dsKhoa, setDsKhoa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ maKhoa: "", tenKhoa: "", moTa: "" });
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");

  const fetchKhoa = async () => {
    try {
      const res = await axios.get("/khoa");
      setDsKhoa(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      console.error("❌ Lỗi load khoa:", err);
      toast.error("Lỗi khi tải danh sách khoa");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKhoa();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        await axios.put(`/khoa/${form.maKhoa}`, {
          tenKhoa: form.tenKhoa,
          moTa: form.moTa,
        });
        toast.success("✅ Sửa thành công");
      } else {
        await axios.post("/khoa", {
          tenKhoa: form.tenKhoa,
          moTa: form.moTa,
        });
        toast.success("✅ Tạo mới thành công");
      }
      setForm({ maKhoa: "", tenKhoa: "", moTa: "" });
      setEditMode(false);
      fetchKhoa();
    } catch (err) {
      toast.error("❌ Lỗi xử lý: " + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (khoa) => {
    setForm(khoa);
    setEditMode(true);
  };

  const handleDelete = async (maKhoa) => {
    if (!window.confirm("Bạn có chắc muốn xoá khoa này?")) return;
    try {
      await axios.delete(`/khoa/${maKhoa}`);
      toast.success("✅ Xoá thành công");
      fetchKhoa();
    } catch (err) {
      toast.error("❌ Không thể xoá khoa: " + (err.response?.data?.message || err.message));
    }
  };

  const handleCancel = () => {
    setForm({ maKhoa: "", tenKhoa: "", moTa: "" });
    setEditMode(false);
  };

  const filtered = dsKhoa.filter(
    (k) =>
      k.tenKhoa?.toLowerCase().includes(search.toLowerCase()) ||
      k.maKhoa?.toLowerCase().includes(search.toLowerCase()) ||
      k.moTa?.toLowerCase().includes(search.toLowerCase())
  );

  const pagination = useAdminPagination(filtered, {
    initialPageSize: 10,
    resetKey: search,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6"}>
      {/* Header */}
      {!embedded && (
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-xl shadow-lg">
            <Building2 size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Quản lý khoa</h1>
            <p className="text-gray-600">Quản lý các khoa phòng trong bệnh viện</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên khoa, mã khoa hoặc mô tả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-sm"
          />
        </div>
      </div>
      )}

      {embedded && (
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Tìm khoa, mã, mô tả..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white"
          />
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {editMode ? <Edit size={24} className="text-indigo-600" /> : <Plus size={24} className="text-indigo-600" />}
            {editMode ? "Sửa khoa" : "Thêm khoa mới"}
          </h2>
          {editMode && (
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tên khoa *</label>
              <input
                type="text"
                name="tenKhoa"
                placeholder="Tên khoa"
                value={form.tenKhoa}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mã khoa {editMode && `(${form.maKhoa})`}</label>
              <input
                type="text"
                value={form.maKhoa}
                disabled
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả</label>
            <textarea
              name="moTa"
              placeholder="Mô tả về khoa..."
              value={form.moTa || ""}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end gap-3">
            {editMode && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
            )}
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md flex items-center gap-2"
            >
              <Save size={18} />
              {editMode ? "💾 Lưu sửa" : "➕ Thêm mới"}
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <Building2 size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Không có khoa nào</h3>
          <p className="text-gray-500">Thử thay đổi từ khóa tìm kiếm hoặc thêm khoa mới</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Mã khoa</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Tên khoa</th>
                  <th className="px-6 py-4 text-left font-semibold text-gray-700">Mô tả</th>
                  <th className="px-6 py-4 text-center font-semibold text-gray-700">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagination.pageItems.map((khoa) => (
                  <tr key={khoa.maKhoa} className="hover:bg-indigo-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-semibold">
                        {khoa.maKhoa}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 font-semibold">{khoa.tenKhoa}</td>
                    <td className="px-6 py-4 text-gray-600">{khoa.moTa || <span className="text-gray-400 italic">Không có mô tả</span>}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(khoa)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Sửa"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(khoa.maKhoa)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <AdminPagination pagination={pagination} itemLabel="khoa" />
          )}
        </div>
      )}
    </div>
  );
};

export default ManageKhoa;
