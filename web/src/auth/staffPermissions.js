import { STAFF_ROLES } from "./cognitoAuth";

export { STAFF_ROLES };

export const STAFF_PERMISSIONS = {
  ADMIN: [
    "dashboard.admin",
    "account.manage",
    "staff.manage",
    "patient.read",
    "patient.write",
    "doctor.manage",
    "news.manage",
    "feedback.manage",
    "report.view",
    "system.config",
  ],
  BACSI: [
    "dashboard.doctor",
    "appointment.read",
    "appointment.write",
    "medical-record.read",
    "medical-record.write",
    "prescription.write",
    "lab-request.manage",
    "schedule.read",
  ],
  THUNGAN: [
    "dashboard.cashier",
    "billing.read",
    "billing.process",
    "invoice.print",
  ],
  NHANSU: [
    "dashboard.staff",
    "patient.register",
    "appointment.register",
    "lab.process",
    "intake.manage",
  ],
};

export const NHANSU_LOAI_PERMISSIONS = {
  YT: ["patient.register", "vitals.record", "doctor-schedule.view"],
  XN: ["lab.request.process", "lab.result.write"],
  TN: ["intake.register", "appointment.manage", "medical-record.intake", "schedule.manage", "doctor-schedule.view"],
};

export const STAFF_PORTAL_PATHS = ["/admin", "/doctor", "/yta", "/xetnghiem", "/tiepnhan", "/thungan"];

export const isStaffPortalPath = (pathname) =>
  STAFF_PORTAL_PATHS.some((p) => pathname.startsWith(p));

export const getStaffPermissions = (role, loaiNS = "") => {
  const base = STAFF_PERMISSIONS[role] || [];
  if (role === "NHANSU" && loaiNS && NHANSU_LOAI_PERMISSIONS[loaiNS]) {
    return [...new Set([...base, ...NHANSU_LOAI_PERMISSIONS[loaiNS]])];
  }
  return base;
};

export const hasStaffPermission = (role, loaiNS, permission) =>
  getStaffPermissions(role, loaiNS).includes(permission);

/** Route → allowed roles (+ loaiNS cho NHANSU) */
export const STAFF_ROUTE_RULES = {
  "/admin": { roles: ["ADMIN"] },
  "/doctor": { roles: ["BACSI"] },
  "/yta": { roles: ["NHANSU"], loaiNS: ["YT"] },
  "/xetnghiem": { roles: ["NHANSU"], loaiNS: ["XN"] },
  "/tiepnhan": { roles: ["NHANSU"], loaiNS: ["TN"] },
  "/thungan": { roles: ["THUNGAN"] },
};

export const matchStaffRouteRule = (pathname) => {
  for (const [prefix, rule] of Object.entries(STAFF_ROUTE_RULES)) {
    if (pathname.startsWith(prefix)) return rule;
  }
  return null;
};
