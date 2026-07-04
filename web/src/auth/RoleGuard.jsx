import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isStaffRole, getEffectiveRole } from "./rbac";
import { matchStaffRouteRule } from "./staffPermissions";

/**
 * Guard phân quyền nhân viên nội bộ (ADMIN, BACSI, NHANSU).
 * Dùng nested trong PrivateRoute cho từng khu vực staff.
 *
 * @param {string[]} allowedRoles - VD: ['ADMIN'] | ['BACSI'] | ['NHANSU']
 * @param {string[]} [allowedLoaiNS] - VD: ['YT'] cho /yta
 */
const RoleGuard = ({ allowedRoles, allowedLoaiNS }) => {
  const { token, role, loaiNS, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/staff/login" state={{ from: location.pathname }} replace />;
  }

  const effectiveRole = role || getEffectiveRole();
  const effectiveLoaiNS = loaiNS || localStorage.getItem("loaiNS") || "";

  if (!isStaffRole(effectiveRole)) {
    return <Navigate to="/404" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    return <Navigate to="/403" replace />;
  }

  if (
    effectiveRole === "NHANSU" &&
    allowedLoaiNS?.length &&
    !allowedLoaiNS.includes(effectiveLoaiNS)
  ) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
};

/** Tự suy allowedRoles từ pathname */
export const AutoRoleGuard = () => {
  const location = useLocation();
  const rule = matchStaffRouteRule(location.pathname);

  if (!rule) return <Outlet />;

  return <RoleGuard allowedRoles={rule.roles} allowedLoaiNS={rule.loaiNS} />;
};

export default RoleGuard;
