import React, { useEffect, useState } from "react";
import axios from "../../api/axiosClient";
import toast from "react-hot-toast";
import { MapPin, Search, Edit, Trash2, Plus, X, Save, Phone, Mail } from "lucide-react";

const emptyForm = {
  maPKN: "",
  tenPKN: "",
  diaChi: "",
  soDienThoai: "",
  email: "",
  trangThai: 1,
  ghiChu: "",
};

function ManagePhongKham() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState("");

  const fetchList = async () => {
    try {
      const res = await axios.get("/phongkhamngoai");
      setList(Array.isArray(res.data.data) ? res.data.data : []);
    } catch (err) {
      toast.error("Lỗi khi tải danh sách phòng khám");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "trangThai" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        await axios.put(`/phongkhamngoai/${form.maPKN}`, {
          tenPKN: form.tenPKN,
          diaChi: form.diaChi,
          soDienThoai: form.soDienThoai,
          email: form.email,
          trangThai: form.trangThai,
          ghiChu: form.ghiChu,
        });
        toast.success("Cập nhật phòng khám thành công");
      } else {
        await axios.post("/phongkhamngoai", form);
        toast.success("Thêm phòng khám thành công");
      }
      setForm(emptyForm);
      setEditMode(false);
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi xử lý phòng khám");
    }
  };

  const handleEdit = (item) => {
    setForm({ ...item, trangThai: item.trangThai ?? 1 });
    setEditMode(true);
  };

  const handleDelete = async (maPKN) => {
    if (!window.confirm("Xóa phòng khám này?")) return;
    try {
      await axios.delete(`/phongkhamngoai/${maPKN}`);
      toast.success("Đã xóa phòng khám");
      fetchList();
    } catch (err) {
      toast.error(err.response?.data?.message || "Không thể xóa phòng khám");
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
    setEditMode(false);
  };

  const filtered = list.filter(
    (p) =>
      p.tenPKN?.toLowerCase().includes(search.toLowerCase()) ||
      p.maPKN?.toLowerCase().includes(search.toLowerCase()) ||
      p.diaChi?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin h-10 w-10 border-4 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Tìm tên, mã, địa chỉ phòng khám..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white"
        />
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 mb-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            {editMode ? <Edit size={20} className="text-teal-600" /> : <Plus size={20} className="text-teal-600" />}
            {editMode ? "Sửa phòng khám" : "Thêm phòng khám"}
          </h2>
          {editMode && (
            <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng khám *</label>
              <input
                name="tenPKN"
                value={form.tenPKN}
                onChange={handleChange}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mã {editMode && `(${form.maPKN})`}</label>
              <input
                value={editMode ? form.maPKN : "Tự sinh khi lưu"}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
              <input
                name="diaChi"
                value={form.diaChi}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
              <input
                name="soDienThoai"
                value={form.soDienThoai}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                name="trangThai"
                value={form.trangThai}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value={1}>Hoạt động</option>
                <option value={0}>Ngưng</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              name="ghiChu"
              value={form.ghiChu}
              onChange={handleChange}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            {editMode && (
              <button type="button" onClick={handleCancel} className="px-4 py-2 border rounded-lg text-gray-600">
                Hủy
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 flex items-center gap-2"
            >
              <Save size={16} />
              {editMode ? "Lưu" : "Thêm mới"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Mã</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Tên phòng khám</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Liên hệ</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Trạng thái</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-600">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Không có phòng khám
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.maPKN} className="hover:bg-teal-50/50">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-xs font-bold">
                      {p.maPKN}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-800">{p.tenPKN}</p>
                    {p.diaChi && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} /> {p.diaChi}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs space-y-0.5">
                    {p.soDienThoai && (
                      <p className="flex items-center gap-1">
                        <Phone size={12} /> {p.soDienThoai}
                      </p>
                    )}
                    {p.email && (
                      <p className="flex items-center gap-1">
                        <Mail size={12} /> {p.email}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        p.trangThai ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.trangThai ? "Hoạt động" : "Ngưng"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(p)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.maPKN)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ManagePhongKham;
