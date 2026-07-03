import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isStaffRole } from "./rbac";

/**
 * Guard for internal staff routes (ADMIN, BACSI, NHANSU).
 * Use as nested route wrapper when a section must be staff-only.
 */
const StaffRoute = ({ allowedRoles }) => {
  const { token, role, loading } = useAuth();

  if (loading) return null;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const roles = allowedRoles || ["ADMIN", "BACSI", "NHANSU"];

  if (!isStaffRole(role) || !roles.includes(role)) {
    return <Navigate to="/404" replace />;
  }

  return <Outlet />;
};

export default StaffRoute;
