import { Link } from "react-router-dom";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl mb-4">🚫</p>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Không có quyền truy cập</h1>
        <p className="text-slate-500 text-sm mb-6">
          Tài khoản của bạn không có quyền truy cập khu vực này. Vui lòng liên hệ quản trị viên
          nếu bạn cho rằng đây là lỗi.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/staff/login"
            className="px-5 py-2.5 rounded-xl bg-[#3498DB] text-white text-sm font-semibold hover:bg-[#2E86C1]"
          >
            Cổng nhân viên
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-white"
          >
            Trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
