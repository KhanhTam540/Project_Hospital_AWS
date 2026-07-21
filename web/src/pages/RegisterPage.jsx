import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import AuthLayout, {
  AuthButton,
  AuthInput,
  AuthLink,
} from "../components/auth/AuthLayout";
import { cognitoSignUp } from "../auth/cognitoAuth";
import { isCognitoEnabled } from "../config/cognito";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CCCD_RE = /^\d{12}$/;
const STRONG_PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/;

function RegisterPage() {
  const navigate = useNavigate();
  const cognitoEnabled = isCognitoEnabled();

  const [fullName, setFullName] = useState("");
  const [citizenId, setCitizenId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const nextErrors = {};
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCitizenId = citizenId.replace(/\D/g, "");

    if (!fullName.trim()) {
      nextErrors.fullName = "Vui lòng nhập họ và tên.";
    }

    if (!normalizedCitizenId) {
      nextErrors.citizenId = "Vui lòng nhập số CCCD.";
    } else if (!CCCD_RE.test(normalizedCitizenId)) {
      nextErrors.citizenId = "CCCD phải gồm đúng 12 chữ số.";
    }

    if (!normalizedEmail) {
      nextErrors.email = "Vui lòng nhập email.";
    } else if (!EMAIL_RE.test(normalizedEmail)) {
      nextErrors.email = "Email không đúng định dạng.";
    }

    if (!password) {
      nextErrors.password = "Vui lòng nhập mật khẩu.";
    } else if (!STRONG_PASSWORD_RE.test(password)) {
      nextErrors.password =
        "Mật khẩu tối thiểu 10 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";
    }

    if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!cognitoEnabled) {
      toast.error(
        "Hệ thống xác thực chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
      );
      return;
    }

    if (!validate()) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCitizenId = citizenId.replace(/\D/g, "");

    try {
      setLoading(true);

      const result = await cognitoSignUp({
        email: normalizedEmail,
        password,
        name: fullName.trim(),
        cccd: normalizedCitizenId,
      });

      sessionStorage.setItem("pendingConfirmationEmail", normalizedEmail);

      if (result.isSignUpComplete) {
        toast.success("Đăng ký thành công. Bạn có thể đăng nhập.");
        navigate("/login", {
          replace: true,
          state: { email: normalizedEmail },
        });
        return;
      }

      toast.success("Mã xác nhận đã được gửi đến email của bạn.");
      navigate("/confirm-email", {
        state: {
          email: normalizedEmail,
          destination: result.nextStep?.codeDeliveryDetails?.destination,
        },
      });
    } catch (error) {
      const message = String(error?.message || "Đăng ký thất bại.");

      if (error?.name === "UsernameExistsException") {
        sessionStorage.setItem("pendingConfirmationEmail", normalizedEmail);
        toast.error("Email đã tồn tại. Hãy xác nhận hoặc đăng nhập.");
        navigate("/confirm-email", { state: { email: normalizedEmail } });
        return;
      }

      if (message.toUpperCase().includes("CCCD")) {
        toast.error(
          message.includes("đã")
            ? message
            : "CCCD không hợp lệ hoặc đã được sử dụng bởi tài khoản khác.",
        );
        return;
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Đăng ký tài khoản"
      subtitle="Tạo tài khoản bệnh nhân để đặt lịch và theo dõi hồ sơ trực tuyến"
      panelEyebrow="BẮT ĐẦU CÙNG HOSPITAL P2TB"
      panelTitle="Chủ động chăm sóc sức khỏe ngay từ hôm nay"
      panelDescription="Đăng ký tài khoản để sử dụng các dịch vụ trực tuyến của bệnh viện nhanh chóng và thuận tiện hơn."
      panelItems={[
        "CCCD được dùng làm mã hồ sơ bệnh án",
        "Đặt lịch khám trực tuyến thuận tiện",
        "Theo dõi hồ sơ và hóa đơn tập trung",
      ]}
      panelNote="Sau khi xác nhận email, hệ thống tự tạo hồ sơ bệnh án theo số CCCD."
      icon="📝"
      footer={
        <p>
          Đã có tài khoản? <AuthLink to="/login">Đăng nhập</AuthLink>
        </p>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <AuthInput
          label="Họ và tên"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={errors.fullName}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
          disabled={loading}
          autoFocus
        />

        <AuthInput
          label="CCCD"
          value={citizenId}
          onChange={(event) =>
            setCitizenId(event.target.value.replace(/\D/g, "").slice(0, 12))
          }
          error={errors.citizenId}
          placeholder="Nhập đúng 12 chữ số CCCD"
          inputMode="numeric"
          autoComplete="off"
          minLength={12}
          maxLength={12}
          disabled={loading}
        />

        <p className="-mt-2 mb-4 text-xs leading-5 text-slate-500">
          CCCD là định danh duy nhất và sẽ được dùng làm mã hồ sơ bệnh án. Sau
          khi đăng ký, bệnh nhân không tự thay đổi trường này.
        </p>

        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
          placeholder="email@gmail.com"
          autoComplete="email"
          disabled={loading}
        />

        <AuthInput
          label="Mật khẩu"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
          autoComplete="new-password"
          disabled={loading}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? "👁️" : "🙈"}
            </button>
          }
        />

        <AuthInput
          label="Xác nhận mật khẩu"
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
          disabled={loading}
        />

        <AuthButton type="submit" loading={loading} variant="primary">
          {loading ? "Đang đăng ký..." : "Đăng ký và nhận mã"}
        </AuthButton>
      </form>

      <p className="mt-4 text-center text-xs text-slate-400">
        Hãy dùng email thật. Các địa chỉ @example.com không nhận được mã xác nhận.
      </p>
    </AuthLayout>
  );
}

export default RegisterPage;
