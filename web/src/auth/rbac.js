import { STAFF_ROLES } from "./cognitoAuth";

export { STAFF_ROLES };

export const Roles = {
  ADMIN: "ADMIN",
  BACSI: "BACSI",
  NHANSU: "NHANSU",
  THUNGAN: "THUNGAN",
  BENHNHAN: "BENHNHAN",
};

const STAFF_PATHS = {
  ADMIN: "/admin",
  BACSI: "/doctor",
  THUNGAN: "/thungan",
  NHANSU: {
    YT: "/yta",
    XN: "/xetnghiem",
    TN: "/tiepnhan",
    default: "/tiepnhan",
  },
  BENHNHAN: "/patient",
};

export const getHomeRoute = (role, loaiNS = "") => {
  switch (role) {
    case Roles.ADMIN:
      return STAFF_PATHS.ADMIN;
    case Roles.BACSI:
      return STAFF_PATHS.BACSI;
    case Roles.THUNGAN:
      return STAFF_PATHS.THUNGAN;
    case Roles.BENHNHAN:
      return STAFF_PATHS.BENHNHAN;
    case Roles.NHANSU:
      if (loaiNS === "YT") return STAFF_PATHS.NHANSU.YT;
      if (loaiNS === "XN") return STAFF_PATHS.NHANSU.XN;
      if (loaiNS === "TN") return STAFF_PATHS.NHANSU.TN;
      return STAFF_PATHS.NHANSU.default;
    default:
      return "/404";
  }
};

export const canAccessPath = (role, loaiNS, pathname) => {
  if (!role) return false;

  if (role === Roles.ADMIN) return pathname.startsWith("/admin");
  if (role === Roles.BACSI) return pathname.startsWith("/doctor");
  if (role === Roles.THUNGAN) return pathname.startsWith("/thungan");
  if (role === Roles.BENHNHAN) return pathname.startsWith("/patient");

  if (role === Roles.NHANSU) {
    if (loaiNS === "YT") return pathname.startsWith("/yta");
    if (loaiNS === "XN") return pathname.startsWith("/xetnghiem");
    if (loaiNS === "TN") return pathname.startsWith("/tiepnhan");
    return pathname.startsWith("/tiepnhan");
  }

  return false;
};

export const isStaffRole = (role) => STAFF_ROLES.includes(role);

export const getClaimsFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem("cognitoClaims") || "{}");
  } catch {
    return {};
  }
};

export const getEffectiveRole = () => {
  const storedRole = localStorage.getItem("role");
  if (storedRole) return storedRole;

  const claims = getClaimsFromStorage();
  const groups = claims["cognito:groups"] || [];
  for (const role of ["ADMIN", "BACSI", "NHANSU", "THUNGAN", "BENHNHAN"]) {
    if (groups.includes(role)) return role;
  }
  return claims["custom:maNhom"] || null;
};
