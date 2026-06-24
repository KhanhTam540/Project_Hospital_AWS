import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import ChatbotWidget from "../components/Chatbot/ChatbotWidget.jsx";
import AuthLayout, { AuthInput, AuthButton, AuthLink } from "../components/auth/AuthLayout";
import { isCognitoEnabled } from "../config/cognito";
import { cognitoSignIn, cognitoSignOut } from "../auth/cognitoAuth";
import { getHomeRoute, isStaffRole } from "../auth/rbac";
import { useAuth } from "../auth/AuthContext";

function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const cognitoMode = isCognitoEnabled();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const persistLegacySession = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("maTK", user.maTK);
    localStorage.setItem("role", user.maNhom);
    localStorage.setItem("loaiNS", user.loaiNS || "");
    localStorage.setItem("authProvider", "legacy");

    if (user.maNhom === "BENHNHAN") localStorage.setItem("maBN", user.maBN || user.maTK);
    if (user.maNhom === "BACSI") localStorage.setItem("maBS", user.maBS || "");

    setSession({
      token,
      role: user.maNhom,
      maTK: user.maTK,
      loaiNS: user.loaiNS || "",
      user,
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (cognitoMode) {
        const result = await cognitoSignIn(username, password);

        if (result.needsConfirmation) {
          toast.error("Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư.");
          navigate("/register", { state: { email: username, needsConfirm: true } });
          return;
        }

        const { user } = result;

        if (isStaffRole(user.maNhom)) {
          await cognitoSignOut();
          toast.error("Tài khoản nhân viên — vui lòng đăng nhập tại Cổng nhân viên.");
          navigate("/staff/login");
          return;
        }

        setSession({
          token: localStorage.getItem("token"),
          role: user.maNhom,
          maTK: user.maTK,
          loaiNS: user.loaiNS || "",
          user,
        });

        toast.success("Đăng nhập thành công!");
        navigate(getHomeRoute(user.maNhom, user.loaiNS));
        return;
      }

      const res = await axios.post("/auth/login", {
        tenDangNhap: username,
        matKhau: password,
      });

      if (res.data?.token && res.data?.user) {
        const { token, user } = res.data;
        persistLegacySession(token, user);
        toast.success("Đăng nhập thành công!");
        navigate(getHomeRoute(user.maNhom, user.loaiNS));
      } else {
        toast.error("Sai tài khoản hoặc mật khẩu!");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Sai tài khoản hoặc mật khẩu!";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <AuthLayout
        title="Đăng nhập"
        subtitle={cognitoMode ? "Xác thực qua AWS Cognito" : "Đăng nhập tài khoản hệ thống"}
        icon="🔑"
        footer={
          <div className="space-y-2">
            <p>
              Chưa có tài khoản? <AuthLink to="/register">Đăng ký ngay</AuthLink>
            </p>
            <p className="text-xs text-slate-400">
              Nhân viên nội bộ?{" "}
              <AuthLink to="/staff/login">Đăng nhập tại Cổng nhân viên</AuthLink>
            </p>
          </div>
        }
      >
        <form onSubmit={handleLogin}>
          <AuthInput
            label={cognitoMode ? "Email hoặc tên đăng nhập" : "Tên đăng nhập"}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={cognitoMode ? "email@example.com" : "Nhập tên đăng nhập"}
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
            {loading ? "Đang xử lý..." : "Đăng nhập"}
          </AuthButton>
        </form>

        {cognitoMode && (
          <p className="mt-4 text-center text-xs text-slate-400">
            Bệnh nhân đăng ký/đăng nhập tại đây. Nhân viên dùng{" "}
            <Link to="/staff/login" className="text-sky-600 font-semibold hover:underline">
              Cổng nhân viên
            </Link>
            .
          </p>
        )}
      </AuthLayout>

      <div className="fixed bottom-4 right-4 z-50">
        <ChatbotWidget />
      </div>
    </>
  );
}

export default LoginPage;
