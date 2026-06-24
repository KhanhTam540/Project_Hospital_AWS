import React, { useEffect, useState } from "react";
import {
  getLichByBS,
  createLich,
  deleteLich,
} from "../../../services/lich/lichlamviecService";
import axios from "../../../api/axiosClient";
import dayjs from "dayjs";

const LichLamViecPage = () => {
  const maBS = localStorage.getItem("maBS");

  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    maCa: "",
    ngayBatDauTuan: "",
    createForWeek: true, // Mặc định tạo cho cả tuần
  });

  const [caList, setCaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(dayjs().startOf('week').format('YYYY-MM-DD'));

  // Tính toán các ngày trong tuần
  const getWeekDays = (startDate) => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(dayjs(startDate).add(i, 'day'));
    }
    return days;
  };

  const weekDays = getWeekDays(selectedWeek);

  useEffect(() => {
    if (maBS) {
      fetchData();
    }
    fetchCaList();
  }, [maBS, selectedWeek]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getLichByBS(maBS);
      setList(res.data.data || []);
    } catch (err) {
      console.error("❌ Lỗi khi tải lịch làm việc:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCaList = async () => {
    try {
      const res = await axios.get("/catruc");
      setCaList(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách ca:", err);
    }
  };

  // Lấy số lượng bệnh nhân đã đặt trong mỗi ca
  const getSoLuongBenhNhan = async (maCa, ngayLamViec) => {
    try {
      const res = await axios.get("/lichlamviec/soluong", {
        params: { maBS, maCa, ngayLamViec: dayjs(ngayLamViec).format('YYYY-MM-DD') }
      });
      return res.data.data || { soLuong: 0, toiDa: 10, conLai: 10 };
    } catch (err) {
      console.error("Lỗi lấy số lượng:", err);
      return { soLuong: 0, toiDa: 10, conLai: 10 };
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCreate = async () => {
    if (!form.maCa || !form.ngayBatDauTuan) {
      return alert("⚠️ Vui lòng chọn ca và ngày bắt đầu tuần");
    }

    if (form.createForWeek) {
      // Tạo lịch cho cả tuần
      try {
        await createLich({
          maCa: form.maCa,
          ngayLamViec: form.ngayBatDauTuan,
          maBS: maBS,
          createForWeek: true,
        });
        await fetchData();
        setForm({ maCa: "", ngayBatDauTuan: "", createForWeek: true });
        alert("✅ Đã tạo lịch làm việc cho cả tuần thành công!");
      } catch (err) {
        console.error("Lỗi tạo lịch:", err);
        alert("❌ Lỗi tạo lịch: " + (err.response?.data?.message || err.message));
      }
    } else {
      // Tạo lịch cho 1 ngày
      try {
        await createLich({
          maCa: form.maCa,
          ngayLamViec: form.ngayBatDauTuan,
          maBS: maBS,
          createForWeek: false,
        });
        await fetchData();
        setForm({ maCa: "", ngayBatDauTuan: "", createForWeek: true });
        alert("✅ Đã tạo lịch làm việc thành công!");
      } catch (err) {
        console.error("Lỗi tạo lịch:", err);
        alert("❌ Lỗi tạo lịch: " + (err.response?.data?.message || err.message));
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Xoá lịch này?")) {
      try {
        await deleteLich(id);
        await fetchData();
      } catch (err) {
        console.error("Lỗi xóa lịch:", err);
        alert("❌ Lỗi xóa lịch: " + (err.response?.data?.message || err.message));
      }
    }
  };

  // Lấy lịch làm việc cho một ngày cụ thể
  const getLichForDay = (date) => {
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    return list.filter(l => {
      const lichDate = dayjs(l.ngayLamViec).format('YYYY-MM-DD');
      return lichDate === dateStr;
    });
  };

  // Lấy tên ca từ maCa
  const getTenCa = (maCa) => {
    const ca = caList.find(c => c.maCa === maCa);
    return ca ? ca.tenCa : maCa;
  };

  // Lấy thời gian ca
  const getThoiGianCa = (maCa) => {
    const ca = caList.find(c => c.maCa === maCa);
    if (ca) {
      return `${ca.thoiGianBatDau} - ${ca.thoiGianKetThuc}`;
    }
    return '';
  };

  // Component hiển thị số lượng bệnh nhân
  const SoLuongBadge = ({ maCa, ngayLamViec }) => {
    const [soLuong, setSoLuong] = useState({ soLuong: 0, toiDa: 10, conLai: 10 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const load = async () => {
        const data = await getSoLuongBenhNhan(maCa, dayjs(ngayLamViec).format('YYYY-MM-DD'));
        setSoLuong(data);
        setLoading(false);
      };
      load();
    }, [maCa, ngayLamViec]);

    if (loading) {
      return <span className="text-xs text-gray-400">...</span>;
    }

    const isFull = soLuong.soLuong >= soLuong.toiDa;
    return (
      <span className={`text-xs px-2 py-1 rounded ${
        isFull 
          ? 'bg-red-100 text-red-700 font-bold' 
          : soLuong.soLuong >= soLuong.toiDa * 0.8
          ? 'bg-yellow-100 text-yellow-700'
          : 'bg-green-100 text-green-700'
      }`}>
        {soLuong.soLuong}/{soLuong.toiDa}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">📅 Lịch Làm Việc Cá Nhân</h2>
        <p className="text-gray-600">Quản lý lịch làm việc theo tuần - Mỗi ca tối đa 10 người</p>
      </div>

      {/* Form tạo lịch */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-4">➕ Tạo lịch làm việc</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Chọn ca trực</label>
            <select
              name="maCa"
              value={form.maCa}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">-- Chọn ca --</option>
              {caList.map((ca) => (
                <option key={ca.maCa} value={ca.maCa}>
                  {ca.tenCa} ({ca.thoiGianBatDau} - {ca.thoiGianKetThuc})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày bắt đầu tuần</label>
            <input
              type="date"
              name="ngayBatDauTuan"
              value={form.ngayBatDauTuan}
              onChange={handleChange}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              min={dayjs().format('YYYY-MM-DD')}
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="createForWeek"
                checked={form.createForWeek}
                onChange={handleChange}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Tạo cho cả tuần (7 ngày)</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCreate}
              disabled={!form.maCa || !form.ngayBatDauTuan}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              ➕ Tạo lịch
            </button>
          </div>
        </div>
      </div>

      {/* Chọn tuần để xem */}
      <div className="bg-white p-4 rounded-xl shadow border border-gray-200">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">Xem tuần:</label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedWeek(dayjs(selectedWeek).subtract(1, 'week').format('YYYY-MM-DD'))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              ← Tuần trước
            </button>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(dayjs(e.target.value).startOf('week').format('YYYY-MM-DD'))}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setSelectedWeek(dayjs(selectedWeek).add(1, 'week').format('YYYY-MM-DD'))}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
            >
              Tuần sau →
            </button>
            <button
              onClick={() => setSelectedWeek(dayjs().startOf('week').format('YYYY-MM-DD'))}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition"
            >
              Tuần này
            </button>
          </div>
        </div>
      </div>

      {/* Thời khóa biểu */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
        <h3 className="text-xl font-bold text-gray-800 mb-4">📋 Thời Khóa Biểu</h3>
        
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-4">Đang tải lịch làm việc...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Ca / Ngày</th>
                  {weekDays.map((day, idx) => (
                    <th key={idx} className="border border-gray-300 px-4 py-3 text-center font-semibold min-w-[150px]">
                      <div>{day.format('dddd')}</div>
                      <div className="text-sm font-normal">{day.format('DD/MM/YYYY')}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caList.map((ca) => (
                  <tr key={ca.maCa} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-3 bg-gray-50 font-semibold">
                      <div className="font-bold text-blue-700">{ca.tenCa}</div>
                      <div className="text-xs text-gray-600">{ca.thoiGianBatDau} - {ca.thoiGianKetThuc}</div>
                    </td>
                    {weekDays.map((day, dayIdx) => {
                      const lichForDay = getLichForDay(day).filter(l => l.maCa === ca.maCa);
                      const hasLich = lichForDay.length > 0;
                      const lich = hasLich ? lichForDay[0] : null;
                      
                      return (
                        <td key={dayIdx} className="border border-gray-300 px-4 py-3 text-center align-top">
                          {hasLich ? (
                            <div className="space-y-2">
                              <div className="bg-green-100 border-2 border-green-400 rounded-lg p-3">
                                <div className="text-sm font-semibold text-green-800 mb-1">
                                  ✅ Có lịch
                                </div>
                                <div className="text-xs text-gray-600 mb-2">
                                  Mã: {lich.maLichLV}
                                </div>
                                <SoLuongBadge maCa={ca.maCa} ngayLamViec={day} />
                                <button
                                  onClick={() => handleDelete(lich.maLichLV)}
                                  className="mt-2 w-full text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded transition"
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-sm py-4">
                              Chưa có lịch
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-xl">
          <div className="text-sm text-gray-600 mb-1">Tổng số ca đã đăng ký</div>
          <div className="text-2xl font-bold text-blue-700">{list.length}</div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl">
          <div className="text-sm text-gray-600 mb-1">Ca trong tuần này</div>
          <div className="text-2xl font-bold text-green-700">
            {list.filter(l => {
              const lichDateStr = dayjs(l.ngayLamViec).format('YYYY-MM-DD');
              const weekStartStr = dayjs(selectedWeek).format('YYYY-MM-DD');
              const weekEndStr = dayjs(selectedWeek).add(7, 'day').format('YYYY-MM-DD');
              return lichDateStr >= weekStartStr && lichDateStr < weekEndStr;
            }).length}
          </div>
        </div>
        <div className="bg-purple-50 border-2 border-purple-200 p-4 rounded-xl">
          <div className="text-sm text-gray-600 mb-1">Số ca khác nhau</div>
          <div className="text-2xl font-bold text-purple-700">
            {new Set(list.map(l => l.maCa)).size}
          </div>
        </div>
      </div>

      {/* Quản lý quyền cho bác sĩ thực tập */}
      <QuanLyQuyenSection maBS={maBS} />
    </div>
  );
};

// Component quản lý quyền
const QuanLyQuyenSection = ({ maBS }) => {
  const maTK = localStorage.getItem("maTK");
  const [bacSiList, setBacSiList] = useState([]);
  const [quyenList, setQuyenList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    maNguoiDuocUyQuyen: "",
    loaiUyQuyen: "XEM_LICH_LAM_VIEC",
    thoiGianKetThuc: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    moTa: ""
  });

  // Tự động điền mô tả theo loại quyền
  useEffect(() => {
    const moTaMap = {
      "XEM_LICH_LAM_VIEC": "Quyền xem và hỗ trợ lịch làm việc",
      "HO_TRO_LICH_LAM_VIEC": "Quyền hỗ trợ quản lý lịch làm việc",
      "TAO_PHIEU_KHAM": "Quyền tạo và ghi phiếu khám bệnh",
      "GUI_YEU_CAU_XET_NGHIEM": "Quyền gửi yêu cầu xét nghiệm"
    };
    if (form.loaiUyQuyen && !form.moTa) {
      setForm(prev => ({ ...prev, moTa: moTaMap[form.loaiUyQuyen] || "" }));
    }
  }, [form.loaiUyQuyen]);
  const [bacSiInfo, setBacSiInfo] = useState(null);

  useEffect(() => {
    if (maTK) {
      fetchBacSiList();
      fetchQuyenList();
      fetchBacSiInfo();
    }
  }, [maTK]);

  const fetchBacSiInfo = async () => {
    try {
      const res = await axios.get(`/bacsi/tk/${maTK}`);
      setBacSiInfo(res.data.data);
    } catch (err) {
      console.error("Lỗi lấy thông tin bác sĩ:", err);
    }
  };

  const fetchBacSiList = async () => {
    try {
      const res = await axios.get("/bacsi");
      // Chỉ lấy bác sĩ thực tập
      const thucTap = (res.data.data || []).filter(bs => bs.capBac === "Bác sĩ thực tập");
      setBacSiList(thucTap);
    } catch (err) {
      console.error("Lỗi tải danh sách bác sĩ:", err);
    }
  };

  const fetchQuyenList = async () => {
    try {
      const res = await axios.get(`/uyquyen/nguoiuyquyen/${maTK}`);
      setQuyenList(res.data.data || []);
    } catch (err) {
      console.error("Lỗi tải danh sách quyền:", err);
    }
  };

  const handleCreateQuyen = async () => {
    if (!form.maNguoiDuocUyQuyen) {
      alert("Vui lòng chọn bác sĩ thực tập");
      return;
    }

    try {
      await axios.post("/uyquyen", {
        maNguoiUyQuyen: maTK,
        maNguoiDuocUyQuyen: form.maNguoiDuocUyQuyen,
        loaiUyQuyen: form.loaiUyQuyen,
        thoiGianBatDau: new Date().toISOString(),
        thoiGianKetThuc: new Date(form.thoiGianKetThuc).toISOString(),
        moTa: form.moTa
      });
      alert("✅ Cấp quyền thành công!");
      setShowForm(false);
      fetchQuyenList();
      setForm({
        maNguoiDuocUyQuyen: "",
        loaiUyQuyen: "XEM_LICH_LAM_VIEC",
        thoiGianKetThuc: dayjs().add(30, 'day').format('YYYY-MM-DD'),
        moTa: ""
      });
    } catch (err) {
      alert("❌ Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleDeleteQuyen = async (maUyQuyen) => {
    if (!window.confirm("Thu hồi quyền này?")) return;

    try {
      await axios.delete(`/uyquyen/${maUyQuyen}`);
      alert("✅ Thu hồi quyền thành công!");
      fetchQuyenList();
    } catch (err) {
      alert("❌ Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  // Chỉ hiển thị nếu là bác sĩ điều trị trở lên
  const capBac = bacSiInfo?.capBac || "";
  const capBacLevels = {
    "Bác sĩ thực tập": 1,
    "Bác sĩ sơ cấp": 2,
    "Bác sĩ điều trị": 3,
  };
  const level = capBacLevels[capBac] || 3;

  if (level < 3) {
    return null; // Không hiển thị nếu không đủ quyền
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">🔐 Quản Lý Quyền Cho Bác Sĩ Thực Tập</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          {showForm ? "❌ Đóng" : "➕ Cấp quyền mới"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-3">Cấp quyền mới</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Chọn bác sĩ thực tập</label>
              <select
                value={form.maNguoiDuocUyQuyen}
                onChange={(e) => setForm({ ...form, maNguoiDuocUyQuyen: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
              >
                <option value="">-- Chọn bác sĩ --</option>
                {bacSiList.map((bs) => (
                  <option key={bs.maBS} value={bs.maTK}>
                    {bs.hoTen} ({bs.maBS})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Loại quyền</label>
              <select
                value={form.loaiUyQuyen}
                onChange={(e) => setForm({ ...form, loaiUyQuyen: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
              >
                <option value="XEM_LICH_LAM_VIEC">Xem lịch làm việc</option>
                <option value="HO_TRO_LICH_LAM_VIEC">Hỗ trợ lịch làm việc</option>
                <option value="TAO_PHIEU_KHAM">Tạo và ghi phiếu khám bệnh</option>
                <option value="GUI_YEU_CAU_XET_NGHIEM">Gửi yêu cầu xét nghiệm</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Thời gian kết thúc</label>
              <input
                type="date"
                value={form.thoiGianKetThuc}
                onChange={(e) => setForm({ ...form, thoiGianKetThuc: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                min={dayjs().format('YYYY-MM-DD')}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Mô tả</label>
              <input
                type="text"
                value={form.moTa}
                onChange={(e) => setForm({ ...form, moTa: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg"
                placeholder="Mô tả quyền"
              />
            </div>
          </div>
          <button
            onClick={handleCreateQuyen}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            ✅ Cấp quyền
          </button>
        </div>
      )}

      <div>
        <h4 className="font-semibold mb-3">Danh sách quyền đã cấp</h4>
        {quyenList.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Chưa cấp quyền nào</p>
        ) : (
          <div className="space-y-2">
            {quyenList.map((quyen) => {
              const bacSi = quyen.NguoiDuocUyQuyen?.BacSi;
              const isExpired = new Date(quyen.thoiGianKetThuc) < new Date();
              return (
                <div
                  key={quyen.maUyQuyen}
                  className={`p-4 rounded-lg border-2 ${
                    isExpired ? "bg-gray-100 border-gray-300" : "bg-green-50 border-green-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {bacSi?.hoTen || "Bác sĩ"} ({quyen.loaiUyQuyen})
                      </div>
                      <div className="text-sm text-gray-600">
                        {quyen.moTa || "Không có mô tả"}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Từ {dayjs(quyen.thoiGianBatDau).format('DD/MM/YYYY')} đến{" "}
                        {dayjs(quyen.thoiGianKetThuc).format('DD/MM/YYYY')}
                        {isExpired && <span className="text-red-600 ml-2">(Đã hết hạn)</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteQuyen(quyen.maUyQuyen)}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
                    >
                      Thu hồi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LichLamViecPage;
