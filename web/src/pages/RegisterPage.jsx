import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import axios from "../api/axiosClient";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import AuthLayout, { AuthInput, AuthButton, AuthLink } from "../components/auth/AuthLayout";
import { isCognitoEnabled } from "../config/cognito";
import {
  cognitoSignUp,
  cognitoConfirmSignUp,
  cognitoResendCode,
  cognitoSignIn,
} from "../auth/cognitoAuth";
import { getHomeRoute } from "../auth/rbac";
import { useAuth } from "../auth/AuthContext";

const RESEND_COOLDOWN_SEC = 60;
const STRONG_PASS_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuth();
  const cognitoMode = isCognitoEnabled();

  const [tenDangNhap, setTenDangNhap] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [xacNhanMatKhau, setXacNhanMatKhau] = useState("");
  const [email, setEmail] = useState(location.state?.email || "");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(location.state?.needsConfirm || false);
  const [devOtp, setDevOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateFields = () => {
    const newErrors = {};
    if (!tenDangNhap.trim() && !cognitoMode) {
      newErrors.tenDangNhap = "Vui lòng nhập tên đăng nhập";
    }
    if (!email.trim()) newErrors.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Email không đúng định dạng";

    if (!matKhau) newErrors.matKhau = "Vui lòng nhập mật khẩu";
    else if (!STRONG_PASS_REGEX.test(matKhau))
      newErrors.matKhau =
        "Mật khẩu cần tối thiểu 8 ký tự, gồm chữ Hoa, Thường và Số.";

    if (xacNhanMatKhau !== matKhau)
      newErrors.xacNhanMatKhau = "Mật khẩu xác nhận không khớp";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Vui lòng kiểm tra lại thông tin");
      return false;
    }
    setErrors({});
    return true;
  };

  /* ── Cognito registration ── */
  const handleCognitoRegister = async () => {
    if (!validateFields()) return;

    setLoading(true);
    try {
      await cognitoSignUp({
        email,
        password: matKhau,
        name: tenDangNhap || email.split("@")[0],
      });
      toast.success("Mã xác nhận đã gửi tới email!");
      setOtpSent(true);
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      toast.error(err.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleCognitoConfirm = async () => {
    if (!otpCode || otpCode.length < 6) {
      toast.error("Mã xác nhận phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    try {
      await cognitoConfirmSignUp(email, otpCode);
      toast.success("Xác nhận thành công! Đang đăng nhập...");

      const result = await cognitoSignIn(email, matKhau);
      if (result.user) {
        setSession({
          token: localStorage.getItem("token"),
          role: result.user.maNhom,
          maTK: result.user.maTK,
          loaiNS: result.user.loaiNS || "",
          user: result.user,
        });
        navigate(getHomeRoute(result.user.maNhom, result.user.loaiNS));
      } else {
        navigate("/login");
      }
    } catch (err) {
      toast.error(err.message || "Mã xác nhận không hợp lệ");
    } finally {
      setLoading(false);
    }
  };

  const handleCognitoResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    try {
      await cognitoResendCode(email);
      toast.success("Đã gửi lại mã xác nhận");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      toast.error(err.message || "Gửi lại mã thất bại");
    } finally {
      setLoading(false);
    }
  };

  /* ── Legacy OTP registration ── */
  const sendLegacyOtp = useCallback(async () => {
    if (!validateFields()) return false;
    setLoading(true);
    try {
      const res = await axios.post("/auth/register/send-otp", {
        tenDangNhap,
        matKhau,
        email,
        maNhom: "BENHNHAN",
      });
      if (res.data?.devOtp) {
        setDevOtp(res.data.devOtp);
        setOtpCode(res.data.devOtp);
        toast.success(`Dev mode: OTP = ${res.data.devOtp}`);
      } else {
        setDevOtp("");
        setOtpCode("");
        toast.success(res.data?.message || "OTP đã gửi tới email!");
      }
      setOtpSent(true);
      setResendCooldown(RESEND_COOLDOWN_SEC);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi gửi OTP");
      return false;
    } finally {
      setLoading(false);
    }
  }, [tenDangNhap, matKhau, email, xacNhanMatKhau]);

  const verifyLegacyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error("Mã OTP phải có 6 chữ số");
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/auth/register/verify-otp", { email, otpCode });
      if (res.data?.success) {
        toast.success("Đăng ký thành công!");
        navigate("/login");
      } else {
        toast.error(res.data?.message || "Đăng ký thất bại");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Mã OTP không hợp lệ");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cognitoMode) {
      if (!otpSent) await handleCognitoRegister();
      else await handleCognitoConfirm();
      return;
    }
    if (!otpSent) await sendLegacyOtp();
    else await verifyLegacyOtp();
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const res = await axios.post("/auth/google-login", {
        tenDangNhap: decoded.email.split("@")[0],
        email: decoded.email,
        maNhom: "BENHNHAN",
        matKhau: decoded.sub,
      });
      if (res.data?.token && res.data?.user) {
        toast.success("Đăng nhập Google thành công!");
        const { token, user } = res.data;
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("maTK", user.maTK);
        localStorage.setItem("role", user.maNhom);
        navigate("/patient");
      }
    } catch {
      toast.error("Đăng nhập Google thất bại!");
    }
  };

  const fieldsDisabled = otpSent;

  return (
    <>
      <Toaster position="top-center" />
      <AuthLayout
        title="Đăng ký tài khoản"
        subtitle={
          otpSent
            ? cognitoMode
              ? "Bước 2: Xác nhận email"
              : "Bước 2: Nhập mã OTP"
            : "Bước 1: Thông tin tài khoản bệnh nhân"
        }
        icon="🔐"
        footer={
          <p>
            Đã có tài khoản? <AuthLink to="/login">Đăng nhập</AuthLink>
          </p>
        }
      >
        <form onSubmit={handleSubmit}>
          {!cognitoMode && (
            <AuthInput
              label="Tên đăng nhập"
              value={tenDangNhap}
              onChange={(e) => {
                setTenDangNhap(e.target.value);
                setErrors((p) => ({ ...p, tenDangNhap: null }));
              }}
              disabled={fieldsDisabled}
              error={errors.tenDangNhap}
            />
          )}

          {cognitoMode && !otpSent && (
            <AuthInput
              label="Họ và tên (tuỳ chọn)"
              value={tenDangNhap}
              onChange={(e) => setTenDangNhap(e.target.value)}
              placeholder="Nguyễn Văn A"
            />
          )}

          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: null }));
            }}
            disabled={fieldsDisabled}
            error={errors.email}
            autoComplete="email"
          />

          <AuthInput
            label="Mật khẩu"
            type="password"
            value={matKhau}
            onChange={(e) => {
              setMatKhau(e.target.value);
              setErrors((p) => ({ ...p, matKhau: null }));
            }}
            disabled={fieldsDisabled}
            error={errors.matKhau}
            placeholder="Tối thiểu 8 ký tự, Hoa + Thường + Số"
            autoComplete="new-password"
          />

          {!fieldsDisabled && (
            <AuthInput
              label="Xác nhận mật khẩu"
              type="password"
              value={xacNhanMatKhau}
              onChange={(e) => {
                setXacNhanMatKhau(e.target.value);
                setErrors((p) => ({ ...p, xacNhanMatKhau: null }));
              }}
              error={errors.xacNhanMatKhau}
              autoComplete="new-password"
            />
          )}

          {otpSent && (
            <div className="mb-4">
              {devOtp && (
                <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-center text-sm text-amber-800">
                  <strong>Dev:</strong> OTP ={" "}
                  <span className="text-lg font-bold tracking-widest">{devOtp}</span>
                </div>
              )}
              <AuthInput
                label={cognitoMode ? `Mã xác nhận (gửi tới ${email})` : `Mã OTP (gửi tới ${email})`}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(
                    cognitoMode
                      ? e.target.value.trim()
                      : e.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                placeholder={cognitoMode ? "Nhập mã từ email" : "6 chữ số"}
                autoFocus
                maxLength={cognitoMode ? undefined : 6}
                inputMode={cognitoMode ? "text" : "numeric"}
              />

              <div className="flex justify-between items-center mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setOtpCode("");
                    setDevOtp("");
                  }}
                  className="text-xs text-slate-500 hover:underline"
                >
                  ← Sửa thông tin
                </button>
                <button
                  type="button"
                  onClick={cognitoMode ? handleCognitoResend : sendLegacyOtp}
                  disabled={resendCooldown > 0 || loading}
                  className={`text-xs font-semibold ${
                    resendCooldown > 0 ? "text-slate-300" : "text-sky-600 hover:underline"
                  }`}
                >
                  {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : "Gửi lại mã"}
                </button>
              </div>
            </div>
          )}

          <AuthButton type="submit" loading={loading} variant={otpSent ? "success" : "primary"}>
            {loading
              ? "Đang xử lý..."
              : otpSent
                ? "Xác nhận đăng ký"
                : cognitoMode
                  ? "Đăng ký với Cognito"
                  : "Gửi mã OTP"}
          </AuthButton>
        </form>

        {!otpSent && !cognitoMode && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="mt-6">
            <div className="flex items-center gap-3 my-4">
              <hr className="flex-1 border-slate-200" />
              <span className="text-xs text-slate-400">hoặc</span>
              <hr className="flex-1 border-slate-200" />
            </div>
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error("Đăng nhập Google thất bại!")}
              />
            </div>
          </div>
        )}
      </AuthLayout>
    </>
  );
}

export default RegisterPage;
