import { useAuth } from "./AuthContext";
import { hasStaffPermission, getStaffPermissions } from "./staffPermissions";

export const useStaffPermission = () => {
  const { role, loaiNS } = useAuth();

  const permissions =
    role && ["ADMIN", "BACSI", "NHANSU"].includes(role)
      ? getStaffPermissions(role, loaiNS)
      : [];

  const can = (permission) => hasStaffPermission(role, loaiNS, permission);

  return { permissions, can, role, loaiNS };
};
