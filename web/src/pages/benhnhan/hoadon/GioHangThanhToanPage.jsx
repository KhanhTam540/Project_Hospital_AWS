import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  getGioHang,
  addToGioHang,
  confirmGioHang,
  getMyHoaDon,
  getThanhToan,
  deleteItemGioHang,
} from "../../../services/hoadon_BN/hoadonService";
import axios from "../../../api/axiosClient";

import {
  getAllThuoc,
  getAllXetNghiem,
  getAllPhieuKham,
} from "../../../services/hoadon_BN/dichVuService";

const GioHangThanhToanPage = () => {
  const maBN = localStorage.getItem("maBN");
  const maNS = localStorage.getItem("maTK");
  const [searchParams] = useSearchParams();

  const [gioHang, setGioHang] = useState([]);
  const [hoaDonList, setHoaDonList] = useState([]);
  const [chiTietThanhToan, setChiTietThanhToan] = useState([]);
  const [lichChoThanhToan, setLichChoThanhToan] = useState([]);
  const [lichDaHuy, setLichDaHuy] = useState([]);
  
  // Tab state cho hóa đơn
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' hoặc 'history'
  
  // Loading states
  const [loadingGioHang, setLoadingGioHang] = useState(false);
  const [loadingHoaDon, setLoadingHoaDon] = useState(false);
  const [loadingDichVu, setLoadingDichVu] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form thêm dịch vụ vào giỏ
  const [form, setForm] = useState({
    loaiDichVu: "",
    maDichVu: "",
    soLuong: 1,
    donGia: 0,
  });
  const [danhSachDichVu, setDanhSachDichVu] = useState([]);
  const [selectedDichVu, setSelectedDichVu] = useState(null);

  // Form thanh toán Online
  const [formTT, setFormTT] = useState({
    maHD: "",
    soTien: "",
    phuongThuc: "VNPAY",
  });

  // ✅ Load dữ liệu ban đầu
  useEffect(() => {
    if (maBN) {
      const reload = searchParams.get("reload");
      // Nếu có flag reload, không load giỏ hàng (vì đã chuyển thành hóa đơn)
      if (reload !== "true") {
        loadGioHang();
      }
      loadHoaDon();
      loadLichChoThanhToan();
      loadLichDaHuy();
    }
  }, [maBN]);

  // ✅ Reload dữ liệu khi quay lại từ payment result
  useEffect(() => {
    const reload = searchParams.get("reload");
    const maHD = searchParams.get("maHD");
    
    if (reload === "true" && maBN) {
      // Chuyển sang tab lịch sử khi thanh toán thành công
      setActiveTab('history');
      
      // Đợi IPN kịp cập nhật trạng thái hóa đơn với nhiều lần retry
      const reloadWithDelay = async () => {
        // Lần 1: Reload ngay
        await loadHoaDon();
        loadLichChoThanhToan();
        loadLichDaHuy();
        
        // Lần 2: Retry sau 1 giây
        setTimeout(async () => {
          await loadHoaDon();
        }, 1000);
        
        // Lần 3: Retry sau 3 giây
        setTimeout(async () => {
          await loadHoaDon();
          loadLichChoThanhToan();
        }, 3000);
        
        // Lần 4: Retry sau 5 giây
        setTimeout(async () => {
          await loadHoaDon();
        }, 5000);
        
        // Lần 5: Retry sau 8 giây (nếu IPN rất chậm)
        setTimeout(async () => {
          await loadHoaDon();
        }, 8000);
        
        // Nếu có maHD, verify trạng thái cụ thể với polling
        if (maHD) {
          let verifyCount = 0;
          const maxVerifyAttempts = 10;
          
          const verifyPayment = async () => {
            try {
              verifyCount++;
              // Gọi API để lấy thông tin hóa đơn cụ thể
              const res = await getMyHoaDon(maBN);
              const hoaDonData = res.data.data || [];
              const targetHD = hoaDonData.find(hd => hd.maHD === maHD);
              
              if (targetHD) {
                // Cập nhật danh sách hóa đơn
                setHoaDonList(hoaDonData);
                
                if (targetHD.trangThai === 'DA_THANH_TOAN') {
                  // Hóa đơn đã được cập nhật thành công!
                  setActiveTab('history');
                  setFormTT(prev => ({ ...prev, maHD: maHD, soTien: targetHD.tongTien }));
                  await handleXemChiTiet(maHD);
                  
                  // Hiển thị thông báo thành công
                  const successMsg = document.createElement('div');
                  successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                  successMsg.textContent = `✅ Hóa đơn ${maHD} đã được thanh toán thành công!`;
                  document.body.appendChild(successMsg);
                  setTimeout(() => successMsg.remove(), 5000);
                  
                  return true; // Đã verify thành công, dừng polling
                } else if (verifyCount < maxVerifyAttempts) {
                  // Chưa cập nhật, tiếp tục verify sau 2 giây
                  setTimeout(verifyPayment, 2000);
                }
              } else if (verifyCount < maxVerifyAttempts) {
                // Chưa tìm thấy hóa đơn, tiếp tục verify
                setTimeout(verifyPayment, 2000);
              }
            } catch (err) {
              console.error("Lỗi verify thanh toán:", err);
              if (verifyCount < maxVerifyAttempts) {
                setTimeout(verifyPayment, 2000);
              }
            }
          };
          
          // Bắt đầu verify sau 2 giây
          setTimeout(verifyPayment, 2000);
        }
      };
      
      reloadWithDelay();
      
      // Xóa tham số reload khỏi URL sau 12 giây
      setTimeout(() => {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete("reload");
        const newUrl = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
        window.history.replaceState({}, '', newUrl);
      }, 12000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, maBN]);
  
  const loadLichDaHuy = async () => {
    try {
      const res = await axios.get(`/lichkham/benhnhan/${maBN}`);
      const allLich = res.data.data || [];
      const daHuy = allLich.filter(l => l.trangThai === 'DA_HUY');
      setLichDaHuy(daHuy);
    } catch (err) {
      console.error("Lỗi tải lịch đã hủy:", err);
      setLichDaHuy([]);
    }
  };

  const loadLichChoThanhToan = async () => {
    try {
      const res = await axios.get(`/lichkham/benhnhan/${maBN}`);
      const allLich = res.data.data || [];
      const choThanhToan = allLich.filter(l => l.trangThai === 'CHO_THANH_TOAN');
      setLichChoThanhToan(choThanhToan);
    } catch (err) {
      console.error("Lỗi tải lịch chờ thanh toán:", err);
      setLichChoThanhToan([]);
    }
  };

  // ✅ Load giỏ hàng - backend đã trả về 200 với data rỗng nếu không có
  const loadGioHang = useCallback(async () => {
    setLoadingGioHang(true);
    try {
      const res = await getGioHang(maBN);
      setGioHang(res.data.data?.chiTiet || []);
    } catch (err) {
      // Không còn lỗi 404 nữa vì backend đã xử lý, nhưng vẫn catch để an toàn
      console.error("Lỗi tải giỏ hàng:", err);
      setGioHang([]);
    } finally {
      setLoadingGioHang(false);
    }
  }, [maBN]);

  const loadHoaDon = useCallback(async (forceReload = false) => {
    if (!forceReload) {
      setLoadingHoaDon(true);
    }
    try {
      const res = await getMyHoaDon(maBN);
      const hoaDonData = res.data.data || [];
      setHoaDonList(hoaDonData);
      
      // ✅ Tự động chọn hóa đơn nếu có maHD trong URL
      const maHDFromUrl = searchParams.get('maHD');
      if (maHDFromUrl) {
        const selectedHD = hoaDonData.find(hd => hd.maHD === maHDFromUrl);
        if (selectedHD) {
          setFormTT(prev => ({ ...prev, maHD: maHDFromUrl, soTien: selectedHD.tongTien }));
          await handleXemChiTiet(maHDFromUrl);
          
          // Nếu hóa đơn đã thanh toán, chuyển sang tab history
          if (selectedHD.trangThai === 'DA_THANH_TOAN') {
            setActiveTab('history');
          }
        }
      }
    } catch (err) {
      console.error("Lỗi tải hóa đơn:", err);
    } finally {
      if (!forceReload) {
        setLoadingHoaDon(false);
      }
    }
  }, [maBN, searchParams]);

  // Logic chọn dịch vụ để thêm vào giỏ
  const handleLoaiDichVuChange = async (e) => {
    const loai = e.target.value;
    setForm({ ...form, loaiDichVu: loai, maDichVu: "", donGia: 0 });
    setSelectedDichVu(null);
    setLoadingDichVu(true);

    try {
      if (loai === "XETNGHIEM") {
        const res = await getAllXetNghiem();
        setDanhSachDichVu(res.data.data || []);
      } else if (loai === "THUOC") {
        const res = await getAllThuoc();
        setDanhSachDichVu(res.data.data || []);
      } else if (loai === "KHAM") {
        const res = await getAllPhieuKham();
        setDanhSachDichVu(res.data.data || []);
      } else {
        setDanhSachDichVu([]);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách dịch vụ:", err);
      setDanhSachDichVu([]);
    } finally {
      setLoadingDichVu(false);
    }
  };

  const handleMaDichVuChange = (e) => {
    const ma = e.target.value;
    const selected = danhSachDichVu.find(
      (d) => d.maThuoc === ma || d.maXN === ma || d.maPK === ma
    ) || null;
    
    setSelectedDichVu(selected);
    setForm((f) => ({
      ...f,
      maDichVu: ma,
      donGia: selected?.giaBanLe || selected?.chiPhi || 0,
    }));
  };

  const handleAddToGio = async () => {
    if (!form.loaiDichVu || !form.maDichVu) {
      alert("⚠️ Vui lòng chọn loại dịch vụ và dịch vụ");
      return;
    }
    
    if (form.soLuong < 1) {
      alert("⚠️ Số lượng phải lớn hơn 0");
      return;
    }
    
    setSubmitting(true);
    try {
      const thanhTien = form.soLuong * form.donGia;
      await addToGioHang({ ...form, maBN, thanhTien });
      await loadGioHang();
      
      // Reset form
      setForm({ loaiDichVu: "", maDichVu: "", soLuong: 1, donGia: 0 });
      setDanhSachDichVu([]);
      setSelectedDichVu(null);
      
      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      successMsg.textContent = '✅ Đã thêm vào giỏ hàng!';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } catch (err) {
      console.error("Lỗi thêm vào giỏ hàng:", err);
      alert("❌ Lỗi thêm vào giỏ hàng: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleXacNhan = async () => {
    if (gioHang.length === 0) {
      alert("⚠️ Giỏ hàng trống!");
      return;
    }
    
    if (!maNS) {
      alert("❌ Thiếu mã nhân sự. Vui lòng đăng nhập lại.");
      return;
    }
    
    if (!window.confirm(`Xác nhận tạo hóa đơn với tổng tiền ${parseInt(tongTienGioHang).toLocaleString()}đ?`)) {
      return;
    }
    
    setSubmitting(true);
    try {
      await confirmGioHang({ maBN, maNS });
      setGioHang([]); // Clear giỏ hàng ngay lập tức
      await loadHoaDon(); // Reload hóa đơn
      
      const successMsg = document.createElement('div');
      successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
      successMsg.textContent = '✅ Đã tạo hóa đơn thành công!';
      document.body.appendChild(successMsg);
      setTimeout(() => successMsg.remove(), 3000);
    } catch (err) {
      console.error("Lỗi xác nhận giỏ hàng:", err);
      alert("❌ Lỗi tạo hóa đơn: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleXoaItem = async (id) => {
    if (window.confirm("Xoá dòng này khỏi giỏ hàng?")) {
      try {
        await deleteItemGioHang(id);
        await loadGioHang();
      } catch (err) {
        console.error("Lỗi xóa item:", err);
        alert("❌ Lỗi xóa item: " + (err.response?.data?.message || err.message));
      }
    }
  };

  // === XỬ LÝ THANH TOÁN ONLINE ===
  const handleMaHDChange = (value) => {
    const selected = hoaDonList.find((hd) => hd.maHD === value);
    if (selected) {
      setFormTT({ ...formTT, maHD: value, soTien: selected.tongTien });
      handleXemChiTiet(value);
    } else {
      setFormTT({ ...formTT, maHD: value, soTien: "" });
      setChiTietThanhToan([]);
    }
  };

  const handleXemChiTiet = async (maHD) => {
    try {
      const res = await getThanhToan(maHD);
      setChiTietThanhToan(res.data.data || []);
    } catch(e) { 
      console.error("Lỗi tải chi tiết thanh toán:", e);
      setChiTietThanhToan([]);
    }
  };

  const handlePaymentOnline = async () => {
    if (!formTT.maHD) {
      alert("⚠️ Vui lòng chọn hóa đơn");
      return;
    }
    
    const selectedHD = hoaDonList.find(hd => hd.maHD === formTT.maHD);
    if (selectedHD && selectedHD.trangThai === 'DA_HUY') {
      return alert("❌ Hóa đơn này đã bị hủy. Không thể thanh toán.");
    }
    
    if (selectedHD && selectedHD.trangThai === 'DA_THANH_TOAN') {
      return alert("✅ Hóa đơn này đã được thanh toán rồi.");
    }
    
    if (formTT.soTien <= 0) {
      return alert("⚠️ Số tiền không hợp lệ");
    }

    setSubmitting(true);
    try {
      const res = await axios.post("/payment/create-url", {
        maHD: formTT.maHD,
        phuongThuc: formTT.phuongThuc,
      });

      if (res.data.success && res.data.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        alert("❌ Lỗi tạo link thanh toán: " + (res.data.message || "Lỗi không xác định"));
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Lỗi thanh toán:", err);
      alert("❌ Không thể kết nối đến cổng thanh toán: " + (err.response?.data?.message || err.message));
      setSubmitting(false);
    }
  };

  const handleThanhToanLich = async (maHD) => {
    setFormTT({ ...formTT, maHD });
    setTimeout(() => {
      document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Tính tổng tiền giỏ hàng
  const tongTienGioHang = gioHang.reduce((sum, item) => sum + parseFloat(item.thanhTien || 0), 0);

  // Phân loại hóa đơn
  const hoaDonChuaThanhToan = hoaDonList.filter(hd => hd.trangThai !== 'DA_THANH_TOAN' && hd.trangThai !== 'DA_HUY');
  const hoaDonDaThanhToan = hoaDonList.filter(hd => hd.trangThai === 'DA_THANH_TOAN');
  const hoaDonDaHuy = hoaDonList.filter(hd => hd.trangThai === 'DA_HUY');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🏥 Dịch vụ Y tế & Thanh toán
          </h1>
          <p className="text-gray-600">Quản lý dịch vụ và thanh toán viện phí một cách dễ dàng</p>
        </div>

        {/* ✅ Lịch đặt hẹn chờ thanh toán */}
        {lichChoThanhToan.length > 0 && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 p-6 rounded-2xl shadow-xl mb-6">
            <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center gap-2">
              ⏳ Lịch đặt hẹn đang chờ thanh toán ({lichChoThanhToan.length})
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {lichChoThanhToan.map((lich) => {
                const thoiGianTao = new Date(lich.thoiGianTao);
                const now = new Date();
                const diffMs = now - thoiGianTao;
                const diffMins = Math.floor(diffMs / 60000);
                const remainingMins = Math.max(0, 15 - diffMins);
                
                return (
                  <div key={lich.maLich} className="bg-white p-5 rounded-xl border-2 border-yellow-300 shadow-md">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 text-lg mb-2">Mã lịch: {lich.maLich}</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>📅 {lich.ngayKham} - ⏰ {lich.gioKham}</div>
                          <div>👨‍⚕️ {lich.BacSi?.hoTen || lich.maBS}</div>
                        </div>
                        <div className={`text-sm font-bold mt-3 px-3 py-1 rounded-full inline-block ${
                          remainingMins > 5 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          ⚠️ Còn {remainingMins} phút để thanh toán
                        </div>
                      </div>
                      {lich.maHD && (
                        <button
                          onClick={() => handleThanhToanLich(lich.maHD)}
                          className="ml-4 bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-6 py-3 rounded-xl transition shadow-lg hover:shadow-xl"
                        >
                          💳 Thanh toán
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ✅ Lịch sử lịch đã hủy */}
        {lichDaHuy.length > 0 && (
          <div className="bg-red-50 border-2 border-red-400 p-6 rounded-2xl shadow-xl mb-6">
            <h3 className="text-xl font-bold text-red-800 mb-4 flex items-center gap-2">
              ❌ Lịch đặt hẹn đã bị hủy ({lichDaHuy.length})
            </h3>
            <div className="space-y-3">
              {lichDaHuy.map((lich) => (
                <div key={lich.maLich} className="bg-white p-4 rounded-xl border border-red-300">
                  <div className="font-semibold text-gray-800">Mã lịch: {lich.maLich}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    📅 {lich.ngayKham} - ⏰ {lich.gioKham} | 👨‍⚕️ {lich.BacSi?.hoTen || lich.maBS}
                  </div>
                  <div className="text-xs text-red-600 font-bold mt-2">
                    ⚠️ Đã quá hạn thanh toán (15 phút) - Lịch đã bị hủy
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column: Thêm dịch vụ & Giỏ hàng */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Thêm dịch vụ vào giỏ */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                Thêm dịch vụ vào giỏ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <select 
                  onChange={handleLoaiDichVuChange} 
                  value={form.loaiDichVu} 
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Loại dịch vụ --</option>
                  <option value="KHAM">Khám bệnh</option>
                  <option value="XETNGHIEM">Xét nghiệm</option>
                  <option value="THUOC">Thuốc</option>
                </select>
                <select 
                  onChange={handleMaDichVuChange} 
                  value={form.maDichVu} 
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent md:col-span-2"
                  disabled={!form.loaiDichVu || loadingDichVu}
                >
                  <option value="">-- Chọn dịch vụ --</option>
                  {danhSachDichVu.map((d) => (
                    <option key={d.maThuoc || d.maXN || d.maPK} value={d.maThuoc || d.maXN || d.maPK}>
                      {d.tenThuoc || d.tenXN || d.maPK} - {parseInt(d.giaBanLe || d.chiPhi || 0).toLocaleString()}đ
                    </option>
                  ))}
                </select>
                <input 
                  type="number" 
                  value={form.soLuong} 
                  onChange={(e)=>setForm({...form, soLuong: Math.max(1, parseInt(e.target.value) || 1)})} 
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  placeholder="SL" 
                  min="1"
                  disabled={!selectedDichVu}
                />
                <button 
                  onClick={handleAddToGio} 
                  disabled={!form.loaiDichVu || !form.maDichVu || submitting}
                  className="bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {submitting ? '⏳...' : '➕ Thêm'}
                </button>
              </div>
              {selectedDichVu && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Đơn giá:</span>
                    <span className="font-bold text-blue-600">{parseInt(form.donGia).toLocaleString()}đ</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-600">Thành tiền:</span>
                    <span className="font-bold text-red-600 text-lg">{(form.soLuong * form.donGia).toLocaleString()}đ</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Giỏ hàng */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                Giỏ hàng của bạn
              </h3>
              
              {loadingGioHang ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-4">Đang tải giỏ hàng...</p>
                </div>
              ) : gioHang.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4 text-gray-400 text-4xl">
                    🛒
                  </div>
                  <p className="text-lg font-semibold text-gray-800">Giỏ hàng trống</p>
                  <p className="text-sm text-gray-500 mt-2">Thêm dịch vụ vào giỏ hàng để bắt đầu</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left font-semibold text-gray-700">Dịch vụ</th>
                          <th className="p-3 text-center font-semibold text-gray-700">SL</th>
                          <th className="p-3 text-right font-semibold text-gray-700">Thành tiền</th>
                          <th className="p-3 text-center font-semibold text-gray-700">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gioHang.map((item, i) => (
                          <tr key={i} className="border-t hover:bg-gray-50 transition">
                            <td className="p-3">
                              <div className="font-medium text-gray-800">{item.maDichVu}</div>
                              <div className="text-xs text-gray-500">{item.loaiDichVu}</div>
                            </td>
                            <td className="p-3 text-center">{item.soLuong}</td>
                            <td className="p-3 text-right font-semibold text-red-600">{parseInt(item.thanhTien).toLocaleString()}đ</td>
                            <td className="p-3 text-center">
                              <button 
                                onClick={()=>handleXoaItem(item.maCTGH)} 
                                className="text-red-500 hover:text-red-700 hover:underline text-sm font-medium"
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-6 pt-6 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-gray-700">Tổng tiền:</span>
                      <span className="text-2xl font-bold text-red-600">{parseInt(tongTienGioHang).toLocaleString()}đ</span>
                    </div>
                    <button 
                      onClick={handleXacNhan} 
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition shadow-lg hover:shadow-xl disabled:opacity-50"
                    >
                      {submitting ? '⏳ Đang xử lý...' : '✅ Xác nhận & Tạo hóa đơn'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Hóa đơn */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 sticky top-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                Hóa đơn của bạn
              </h3>
              
              {/* Tabs */}
              <div className="flex gap-2 mb-4 border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-t-lg transition ${
                    activeTab === 'pending'
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ⏳ Chờ thanh toán ({hoaDonChuaThanhToan.length})
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 py-2 px-4 text-sm font-semibold rounded-t-lg transition ${
                    activeTab === 'history'
                      ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  ✅ Đã thanh toán ({hoaDonDaThanhToan.length})
                </button>
              </div>
              
              {loadingHoaDon ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Đang tải...</p>
                </div>
              ) : (
                <>
                  {/* Tab: Hóa đơn chờ thanh toán */}
                  {activeTab === 'pending' && (
                    <>
                      {hoaDonChuaThanhToan.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4 text-gray-400 text-3xl">
                            📄
                          </div>
                          <p className="text-sm font-semibold text-gray-800">Chưa có hóa đơn chờ thanh toán</p>
                          <p className="text-xs text-gray-500 mt-1">Xác nhận giỏ hàng để tạo hóa đơn</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {hoaDonChuaThanhToan.map(hd => (
                            <div 
                              key={hd.maHD} 
                              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                formTT.maHD === hd.maHD 
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-yellow-200 hover:border-yellow-300 hover:shadow-md'
                              }`}
                              onClick={() => handleMaHDChange(hd.maHD)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-blue-600">{hd.maHD}</span>
                                <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700">
                                  ⏳ Chưa thanh toán
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mb-1">
                                {dayjs(hd.ngayLap).format("DD/MM/YYYY HH:mm")}
                              </div>
                              <div className="text-lg font-bold text-red-600">
                                {parseInt(hd.tongTien).toLocaleString()}đ
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Tab: Lịch sử hóa đơn đã thanh toán */}
                  {activeTab === 'history' && (
                    <>
                      {hoaDonDaThanhToan.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center mb-4 text-gray-400 text-3xl">
                            📋
                          </div>
                          <p className="text-sm font-semibold text-gray-800">Chưa có hóa đơn đã thanh toán</p>
                          <p className="text-xs text-gray-500 mt-1">Các hóa đơn đã thanh toán sẽ hiển thị ở đây</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {hoaDonDaThanhToan.map(hd => (
                            <div 
                              key={hd.maHD} 
                              className="p-4 rounded-xl border-2 border-green-200 bg-green-50 cursor-pointer transition-all hover:shadow-md"
                              onClick={() => handleMaHDChange(hd.maHD)}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-bold text-blue-600">{hd.maHD}</span>
                                <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">
                                  ✅ Đã thanh toán
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 mb-1">
                                {dayjs(hd.ngayLap).format("DD/MM/YYYY HH:mm")}
                              </div>
                              <div className="text-lg font-bold text-red-600">
                                {parseInt(hd.tongTien).toLocaleString()}đ
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* 4. Khu vực thanh toán */}
        <div id="payment-section" className="bg-white p-8 rounded-2xl shadow-xl border-t-4 border-blue-500">
          <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span className="text-3xl">💳</span>
            Cổng Thanh Toán Trực Tuyến
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form thanh toán */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Hóa đơn cần thanh toán</label>
                <select 
                  value={formTT.maHD} 
                  onChange={(e) => handleMaHDChange(e.target.value)} 
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                >
                  <option value="">-- Vui lòng chọn hóa đơn --</option>
                  {hoaDonChuaThanhToan.map(h => (
                    <option key={h.maHD} value={h.maHD}>
                      {h.maHD} - {parseInt(h.tongTien).toLocaleString()} VND
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền</label>
                  <input 
                    value={formTT.soTien ? parseInt(formTT.soTien).toLocaleString() + " đ" : ""} 
                    disabled 
                    className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-300 rounded-xl font-bold text-red-600 text-lg" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phương thức</label>
                  <select 
                    value={formTT.phuongThuc} 
                    onChange={(e) => setFormTT({...formTT, phuongThuc: e.target.value})} 
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  >
                    <option value="VNPAY">💳 Ví VNPAY</option>
                    <option value="MOMO">📱 Ví MoMo</option>
                  </select>
                </div>
              </div>

              <button 
                onClick={handlePaymentOnline}
                disabled={!formTT.maHD || submitting || (formTT.maHD && hoaDonList.find(h => h.maHD === formTT.maHD)?.trangThai === 'DA_HUY')}
                className={`w-full py-4 mt-2 font-bold rounded-xl shadow-lg transition-all text-lg ${
                  !formTT.maHD || submitting || (formTT.maHD && hoaDonList.find(h => h.maHD === formTT.maHD)?.trangThai === 'DA_HUY')
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-2xl hover:scale-[1.02]'
                }`}
              >
                {submitting 
                  ? '⏳ Đang xử lý...'
                  : !formTT.maHD 
                  ? 'Vui lòng chọn hóa đơn'
                  : formTT.maHD && hoaDonList.find(h => h.maHD === formTT.maHD)?.trangThai === 'DA_HUY'
                  ? '❌ Hóa đơn đã bị hủy'
                  : '🚀 THANH TOÁN NGAY'}
              </button>
            </div>

            {/* Lịch sử giao dịch */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-xl border-2 border-gray-200">
              <h4 className="font-bold text-gray-700 mb-4 text-lg">📋 Lịch sử giao dịch</h4>
              {!formTT.maHD ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Chọn hóa đơn để xem lịch sử</p>
              ) : chiTietThanhToan.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-8">Chưa có giao dịch nào</p>
              ) : (
                <ul className="space-y-3">
                  {chiTietThanhToan.map(tt => (
                    <li key={tt.maTT} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-gray-700">{tt.phuongThuc}</span>
                        <span className="text-green-600 font-bold">{parseInt(tt.soTien).toLocaleString()}đ</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayjs(tt.ngayThanhToan).format("DD/MM/YYYY HH:mm")}
                      </div>
                      <div className="text-xs mt-1">
                        <span className={`px-2 py-1 rounded ${
                          tt.trangThai === 'THANH_CONG' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {tt.trangThai}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GioHangThanhToanPage;
