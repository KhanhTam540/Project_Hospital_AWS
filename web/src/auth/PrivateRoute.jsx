import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessPath, getEffectiveRole, getHomeRoute } from "./rbac";

import { isStaffPortalPath } from "./staffPermissions";

const PrivateRoute = () => {
  const { token, role, loaiNS, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  if (!token) {
    const loginPath = isStaffPortalPath(location.pathname) ? "/staff/login" : "/login";
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  const effectiveRole = role || getEffectiveRole();
  const effectiveLoaiNS = loaiNS || localStorage.getItem("loaiNS") || "";

  if (!canAccessPath(effectiveRole, effectiveLoaiNS, location.pathname)) {
    const home = getHomeRoute(effectiveRole, effectiveLoaiNS);
    if (home !== "/404" && home !== location.pathname) {
      return <Navigate to={home} replace />;
    }
    return <Navigate to="/404" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
