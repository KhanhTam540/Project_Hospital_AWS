import {
  LayoutDashboard,
  Users,
  UserPlus,
  Shield,
  UserCog,
  Stethoscope,
  Calendar,
  FlaskConical,
  FileText,
  Pill,
  Building2,
  ClipboardList,
  BarChart3,
  Clock,
  Activity,
  MessageSquare,
  Newspaper,
  UserCheck,
} from "lucide-react";

/** Base path cho khu vực quản trị */
export const ADMIN_BASE_PATH = "/admin";

/**
 * Cấu hình menu sidebar admin — đồng bộ với adminRoutes.jsx
 * Thêm/sửa route mới: cập nhật cả file này và adminRoutes.jsx
 */
export const adminMenuSections = [
  {
    title: "Tổng quan",
    items: [{ path: "", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Tài khoản & Phân quyền",
    items: [
      { path: "taikhoan", label: "Danh sách tài khoản", icon: Users },
      { path: "taikhoan/tao-moi", label: "Tạo tài khoản", icon: UserPlus },
      { path: "taikhoan/phan-quyen", label: "Phân quyền", icon: Shield },
      { path: "taikhoan/duyet-dang-ky", label: "Duyệt đăng ký", icon: UserCheck },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { path: "bacsi", label: "Bác sĩ", icon: Stethoscope },
      { path: "nhansu", label: "Nhân viên y tế", icon: UserCog },
      { path: "nhansu/troly", label: "Trợ lý bác sĩ", icon: Activity },
      { path: "nhansu/catruc", label: "Ca trực", icon: Clock },
    ],
  },
  {
    title: "Chuyên môn",
    items: [
      { path: "khoa", label: "Khoa & Phòng khám", icon: Building2 },
      { path: "lichkham", label: "Lịch khám", icon: Calendar },
      { path: "xetnghiem", label: "Xét nghiệm", icon: FlaskConical },
      { path: "loaixetnghiem", label: "Loại xét nghiệm", icon: ClipboardList },
    ],
  },
  {
    title: "Bệnh nhân",
    items: [
      { path: "benhnhan", label: "Quản lý bệnh nhân", icon: Users },
      { path: "hosobenhan", label: "Hồ sơ bệnh án", icon: FileText },
    ],
  },
  {
    title: "Thuốc & Đơn vị",
    items: [
      { path: "thuoc", label: "Quản lý thuốc", icon: Pill },
      { path: "nhomthuoc", label: "Nhóm thuốc", icon: Pill },
      { path: "donvitinh", label: "Đơn vị tính", icon: Pill },
    ],
  },
  {
    title: "Thống kê",
    items: [
      { path: "thongke", label: "Thống kê hóa đơn", icon: BarChart3 },
      { path: "thongke/lichlamviec", label: "Lịch làm việc", icon: BarChart3 },
      { path: "thongke/lickham", label: "Lịch khám", icon: BarChart3 },
    ],
  },
  {
    title: "Hỗ trợ & Thông tin",
    items: [
      { path: "phanhoi", label: "Phản hồi & Ý kiến", icon: MessageSquare },
      { path: "tintuc", label: "Quản lý tin tức", icon: Newspaper },
    ],
  },
];

/** Ghép path đầy đủ cho Link sidebar */
export function getAdminPath(relativePath) {
  if (!relativePath) return ADMIN_BASE_PATH;
  return `${ADMIN_BASE_PATH}/${relativePath}`;
}
