import React from "react";
<<<<<<< HEAD
import { Navigate, Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ConfirmEmailPage from "../pages/ConfirmEmailPage";
=======
import { Routes, Route } from "react-router-dom";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
import NotFoundPage from "../pages/NotFoundPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage.jsx";
import PaymentResultPage from "../pages/benhnhan/hoadon/PaymentResultPage";

import PrivateRoute from "../auth/PrivateRoute";
import RoleGuard from "../auth/RoleGuard";
import StaffLoginPage from "../pages/StaffLoginPage";
import ForbiddenPage from "../pages/ForbiddenPage";
import AdminLayout from "../layouts/AdminLayout";
import { adminRouteElements } from "./adminRoutes";
import DoctorLayout from "../layouts/DoctorLayout";
import PatientLayout from "../layouts/PatientLayout";
import YtaLayout from "../layouts/YtaLayout";
import XetNghiemLayout from "../layouts/XetNghiemLayout";
import TiepNhanLayout from "../layouts/TiepNhanLayout";

import DoctorHome from "../pages/DoctorHome";
import PatientHome from "../pages/PatientHome";
import YTaHome from "../pages/YTaHome";
import TiepNhanHome from "../pages/TiepNhanHome";
import XetNghiemHome from "../pages/XetNghiemHome";

import QuanLyYeuCauXNPage from "../pages/bacsi/xetnghiem/QuanLyYeuCauXNPage";
import LichLamViecPage from "../pages/bacsi/lich/LichLamViecPage";
import PhieuKhamPage from "../pages/bacsi/kham/PhieuKhamPage";
import DoctorQueuePage from "../pages/bacsi/hangcho/DoctorQueuePage";
import KeDonThuocPage from "../pages/bacsi/kham/KeDonThuocPage";
import LichHenKhamPage_BS from "../pages/bacsi/lichhen/LichHenKhamPage_BS";
import ThongTinCaNhanPage_BS from "../pages/bacsi/ThongTinCaNhanPage";

import LichHenKhamPage from "../pages/benhnhan/lich/LichHenKhamPage";
import KetQuaXetNghiemPage from "../pages/benhnhan/xetnghiem/KetQuaXetNghiemPage";
import HoSoBenhAnPage from "../pages/benhnhan/hoso/HoSoBenhAnPage";
import GioHangThanhToanPage from "../pages/benhnhan/hoadon/GioHangThanhToanPage";
import ThongTinCaNhanPage from "../pages/benhnhan/taikhoan/ThongTinCaNhanPage";
import BaoMatTaiKhoanPage from "../pages/benhnhan/taikhoan/BaoMatTaiKhoanPage";
import LienHeYKienPage from "../pages/benhnhan/lienhe/LienHeYKienPage";
import TinTucPage from "../pages/benhnhan/tintuc/TinTucPage";

import DangKyBenhNhanPage from "../pages/nhansu/YTa/DangKyBenhNhanPage";
import NurseVitalsPage from "../pages/nhansu/YTa/NurseVitalsPage";
import LichLamViecBacSiPage from "../pages/nhansu/YTa/LichLamViecBacSiPage";
import YeuCauXNTruocPage from "../pages/nhansu/xetnghiem/YeuCauXNTruocPage";
import PhieuXetNghiem_NSPage from "../pages/nhansu/xetnghiem/PhieuXetNghiem_NSPage";
import DangKyKham_NSPage from "../pages/nhansu/tiepnhan/DangKyKham_NSPage";
import LichHenPage from "../pages/nhansu/tiepnhan/LichHenPage";
import TiepNhanHoSoPage from "../pages/nhansu/tiepnhan/TiepNhanHoSoPage";
import HRLichLamViecPage from "../pages/nhansu/hr/HRLichLamViecPage";

import ThuNganLayout from "../layouts/ThuNganLayout";
import ThuNganHome from "../pages/ThuNganHome";
import CashierBillingPage from "../pages/thungan/CashierBillingPage";

function AppRoutes() {
  return (
    <Routes>
      {/* Trang công khai */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
<<<<<<< HEAD
      <Route path="/dang-nhap" element={<Navigate to="/login" replace />} />
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dang-ky" element={<Navigate to="/register" replace />} />
      <Route path="/confirm-email" element={<ConfirmEmailPage />} />
      <Route path="/xac-thuc-email" element={<Navigate to="/confirm-email" replace />} />
=======
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/payment-result" element={<PaymentResultPage />} />

      {/* Khu vực quản trị — chỉ ADMIN + Cognito group ADMIN */}
      <Route path="/admin" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["ADMIN"]} />}>
          <Route element={<AdminLayout />}>
            {adminRouteElements}
          </Route>
        </Route>
      </Route>

      <Route path="/doctor" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["BACSI"]} />}>
          <Route element={<DoctorLayout />}>
          <Route index element={<DoctorHome />} />
          <Route path="hangcho" element={<DoctorQueuePage />} />
          <Route path="xetnghiem" element={<QuanLyYeuCauXNPage />} />
          <Route path="lich" element={<LichLamViecPage />} />
          <Route path="kham" element={<PhieuKhamPage />} />
          <Route path="kham/donthuoc" element={<KeDonThuocPage />} />
          <Route path="lichhen" element={<LichHenKhamPage_BS />} />
          <Route path="taikhoan" element={<ThongTinCaNhanPage_BS />} />
          </Route>
        </Route>
      </Route>

      <Route path="/patient" element={<PrivateRoute />}>
        <Route element={<PatientLayout />}>
          <Route index element={<PatientHome />} />
          <Route path="lich" element={<LichHenKhamPage />} />
          <Route path="xetnghiem" element={<KetQuaXetNghiemPage />} />
          <Route path="hoso" element={<HoSoBenhAnPage />} />
          <Route path="hoadon" element={<GioHangThanhToanPage />} />
          <Route path="taikhoan" element={<ThongTinCaNhanPage />} />
          <Route path="taikhoan/bao-mat" element={<BaoMatTaiKhoanPage />} />
          <Route path="lienhe" element={<LienHeYKienPage />} />
          <Route path="tintuc" element={<TinTucPage />} />
        </Route>
      </Route>

      <Route path="/yta" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["NHANSU"]} allowedLoaiNS={["YT"]} />}>
          <Route element={<YtaLayout />}>
          <Route index element={<YTaHome />} />
          <Route path="benhnhan/dangky" element={<DangKyBenhNhanPage />} />
          <Route path="benhnhan/sinhhieu" element={<NurseVitalsPage />} />
          <Route path="benhnhan/ghinhantinhtrang" element={<NurseVitalsPage />} />
          <Route path="lichlamviec" element={<LichLamViecBacSiPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/xetnghiem" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["NHANSU"]} allowedLoaiNS={["XN"]} />}>
          <Route element={<XetNghiemLayout />}>
          <Route index element={<XetNghiemHome />} />
          <Route path="xetnghiem/yeucau" element={<YeuCauXNTruocPage />} />
          <Route path="xetnghiem/phieu" element={<PhieuXetNghiem_NSPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/tiepnhan" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["NHANSU"]} allowedLoaiNS={["TN"]} />}>
          <Route element={<TiepNhanLayout />}>
          <Route index element={<TiepNhanHome />} />
          <Route path="lichkham" element={<DangKyKham_NSPage />} />
          <Route path="lichHen" element={<LichHenPage />} />
          <Route path="hsba" element={<TiepNhanHoSoPage />} />
          <Route path="lichlamviec" element={<HRLichLamViecPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/thungan" element={<PrivateRoute />}>
        <Route element={<RoleGuard allowedRoles={["THUNGAN"]} />}>
          <Route element={<ThuNganLayout />}>
            <Route index element={<ThuNganHome />} />
            <Route path="thanhtoan" element={<CashierBillingPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
