import React from "react";
import { Route } from "react-router-dom";

import AdminHome from "../pages/AdminHome";
import AdminUserList from "../pages/admin/AdminUserList";
import CreateUserForm from "../pages/admin/CreateUserForm";
import AssignRole from "../pages/admin/AssignRole";
import ManageKhoaPhongPage from "../pages/admin/ManageKhoaPhongPage";
import AccountApprovalPage from "../pages/admin/AccountApprovalPage";
import ManageBacSi from "../pages/admin/ManageBacSi";
import ManageNhanSu from "../pages/admin/ManageNhanSu";
import ManageBenhNhan from "../pages/admin/ManageBenhNhan";
import ManageLichKham from "../pages/admin/ManageLichKham";
import ManageXetNghiem from "../pages/admin/ManageXetNghiem";
import ManageLoaiXN from "../pages/admin/ManageLoaiXN";
import ManageHoSoBenhAn from "../pages/admin/ManageHoSoBenhAn";
import ChiTietHSBAPage from "../pages/admin/ChiTietHSBAPage";
import QuanLyThuocPage from "../pages/admin/thuoc/QuanLyThuocPage";
import QuanLyNhomThuoc from "../pages/admin/thuoc/QuanLyNhomThuoc";
import QuanLyDonViTinh from "../pages/admin/thuoc/QuanLyDonViTinh";
import TroLyBacSiPage from "../pages/admin/nhansu/TroLyBacSiPage";
import QuanLyCaTrucPage from "../pages/admin/nhansu/QuanLyCaTrucPage";
import ThongKeHoaDonPage from "../pages/admin/thongke/ThongKeHoaDonPage";
import ThongKeLichLamViecPage from "../pages/admin/thongke/ThongKeLichLamViecPage";
import ThongKeLichKhamPage from "../pages/admin/thongke/ThongKeLichKhamPage";
import ManagePhanHoiPage from "../pages/admin/ManagePhanHoiPage";
import ManageTinTucPage from "../pages/admin/ManageTinTucPage";

/**
 * Danh sách route quản trị — index: true cho trang mặc định /admin
 * hidden: true = không hiện trên sidebar (trang chi tiết, form sửa...)
 */
export const adminRouteDefinitions = [
  { path: "", element: AdminHome, index: true },
  { path: "taikhoan", element: AdminUserList },
  { path: "taikhoan/tao-moi", element: CreateUserForm },
  { path: "taikhoan/sua/:id", element: CreateUserForm, hidden: true },
  { path: "taikhoan/phan-quyen", element: AssignRole },
  { path: "taikhoan/duyet-dang-ky", element: AccountApprovalPage },
  { path: "khoa", element: ManageKhoaPhongPage },
  { path: "khoa-phong", element: ManageKhoaPhongPage },
  { path: "bacsi", element: ManageBacSi },
  { path: "nhansu", element: ManageNhanSu },
  { path: "nhansu/troly", element: TroLyBacSiPage },
  { path: "nhansu/catruc", element: QuanLyCaTrucPage },
  { path: "benhnhan", element: ManageBenhNhan },
  { path: "lichkham", element: ManageLichKham },
  { path: "xetnghiem", element: ManageXetNghiem },
  { path: "loaixetnghiem", element: ManageLoaiXN },
  { path: "hosobenhan", element: ManageHoSoBenhAn },
  { path: "hosobenhan/:maHSBA", element: ChiTietHSBAPage, hidden: true },
  { path: "thuoc", element: QuanLyThuocPage },
  { path: "nhomthuoc", element: QuanLyNhomThuoc },
  { path: "donvitinh", element: QuanLyDonViTinh },
  { path: "thongke", element: ThongKeHoaDonPage },
  { path: "thongke/lichlamviec", element: ThongKeLichLamViecPage },
  { path: "thongke/lickham", element: ThongKeLichKhamPage },
  { path: "phanhoi", element: ManagePhanHoiPage },
  { path: "tintuc", element: ManageTinTucPage },
];

/**
 * Phải export JSX fragment trực tiếp — React Router v6 không chấp nhận
 * custom component (<AdminRoutes />) làm con của <Route>.
 */
export const adminRouteElements = (
  <>
    {adminRouteDefinitions.map(({ path, element: Page, index }) =>
      index ? (
        <Route key="admin-index" index element={<Page />} />
      ) : (
        <Route key={path} path={path} element={<Page />} />
      )
    )}
  </>
);
