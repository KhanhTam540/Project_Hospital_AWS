import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import AuthLayout, { AuthInput, AuthButton, AuthLink } from "../components/auth/AuthLayout";
import { isCognitoEnabled } from "../config/cognito";
import { cognitoStaffSignIn } from "../auth/cognitoAuth";
import { getHomeRoute, isStaffRole } from "../auth/rbac";
import { useAuth } from "../auth/AuthContext";

const STAFF_ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  BACSI: "Bác sĩ",
  NHANSU: "Nhân sự y tế",
};

function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const cognitoMode = isCognitoEnabled();
  const from = location.state?.from || "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishLogin = (token, user) => {
    setSession({
      token,
      role: user.maNhom,
      maTK: user.maTK,
      loaiNS: user.loaiNS || "",
      user,
    });

    if (user.permissions) {
      localStorage.setItem("permissions", JSON.stringify(user.permissions));
    }

    toast.success(`Chào mừng — ${STAFF_ROLE_LABELS[user.maNhom] || user.maNhom}`);

    const staffPaths = ["/admin", "/doctor", "/yta", "/xetnghiem", "/tiepnhan"];
    const redirect =
      from && staffPaths.some((p) => from.startsWith(p))
        ? from
        : getHomeRoute(user.maNhom, user.loaiNS);

    navigate(redirect);
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (cognitoMode) {
        const { user } = await cognitoStaffSignIn(username, password);

        if (!isStaffRole(user.maNhom)) {
          toast.error("Tài khoản không thuộc nhân viên nội bộ.");
          return;
        }

        finishLogin(localStorage.getItem("token"), user);
        return;
      }

      const res = await axios.post("/auth/login", {
        tenDangNhap: username,
        matKhau: password,
      });

      if (res.data?.token && res.data?.user) {
        const { token, user } = res.data;

        if (!isStaffRole(user.maNhom)) {
          toast.error("Tài khoản bệnh nhân không thể đăng nhập tại cổng nhân viên.");
          return;
        }

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("maTK", user.maTK);
        localStorage.setItem("role", user.maNhom);
        localStorage.setItem("loaiNS", user.loaiNS || "");
        localStorage.setItem("authProvider", "legacy");

        finishLogin(token, user);
      } else {
        toast.error("Sai tài khoản hoặc mật khẩu!");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || err.message || "Đăng nhập nhân viên thất bại!"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <AuthLayout
        title="Cổng nhân viên nội bộ"
        subtitle={
          cognitoMode
            ? "Xác thực AWS Cognito · ADMIN · BACSI · NHANSU"
            : "Đăng nhập tài khoản nhân viên"
        }
        icon="🛡️"
        footer={
          <div className="space-y-2">
            <p>
              Bệnh nhân? <AuthLink to="/login">Đăng nhập tại đây</AuthLink>
            </p>
            <Link to="/" className="text-xs text-slate-400 hover:underline">
              ← Về trang chủ
            </Link>
          </div>
        }
      >
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          {["ADMIN", "BACSI", "NHANSU"].map((r) => (
            <div
              key={r}
              className="rounded-lg bg-slate-50 border border-slate-100 py-2 px-1"
            >
              <p className="text-[10px] font-bold text-[#21618C]">{r}</p>
              <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                {STAFF_ROLE_LABELS[r]}
              </p>
            </div>
          ))}
        </div>

        <form onSubmit={handleStaffLogin}>
          <AuthInput
            label={cognitoMode ? "Email nhân viên (Cognito)" : "Tên đăng nhập"}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={cognitoMode ? "email@benhvien.vn" : "admin / doctor1"}
            required
            autoComplete="username"
          />

          <AuthInput
            label="Mật khẩu"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 text-lg"
                tabIndex={-1}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            }
          />

          <div className="flex justify-end mb-5">
            <Link
              to="/forgot-password"
              className="text-xs font-semibold text-[#21618C] hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <AuthButton type="submit" loading={loading} variant="primary">
            {loading ? "Đang xác thực..." : "Đăng nhập nhân viên"}
          </AuthButton>
        </form>

        {cognitoMode && (
          <div className="mt-4 p-3 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-800 leading-relaxed">
            <strong>Lưu ý:</strong> Tài khoản nhân viên phải được tạo trong hệ thống và gán
            nhóm Cognito tương ứng (<code className="text-[10px]">ADMIN</code>,{" "}
            <code className="text-[10px]">BACSI</code>,{" "}
            <code className="text-[10px]">NHANSU</code>
            ). Nhân sự cần thêm thuộc tính <code className="text-[10px]">custom:loaiNS</code>{" "}
            (YT / XN / TN).
          </div>
        )}
      </AuthLayout>
    </>
  );
}

export default StaffLoginPage;
