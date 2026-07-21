import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import AuthLayout, {
  AuthButton,
  AuthInput,
  AuthLink,
} from "../components/auth/AuthLayout";
import {
  cognitoConfirmSignUp,
  cognitoResendCode,
} from "../auth/cognitoAuth";

function ConfirmEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail = useMemo(
    () =>
      location.state?.email ||
      sessionStorage.getItem("pendingConfirmationEmail") ||
      "",
    [location.state],
  );

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleConfirm = async (event) => {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.replace(/\D/g, "");

    if (!normalizedEmail) {
      toast.error("Vui lòng nhập email.");
      return;
    }

    if (normalizedCode.length !== 6) {
      toast.error("Mã xác nhận phải gồm 6 chữ số.");
      return;
    }

    try {
      setLoading(true);
      const result = await cognitoConfirmSignUp(normalizedEmail, normalizedCode);

      if (!result.isSignUpComplete) {
        toast.error("Cognito yêu cầu thêm một bước xác nhận khác.");
        return;
      }

      sessionStorage.removeItem("pendingConfirmationEmail");
      toast.success("Xác nhận email thành công. Hãy đăng nhập.");
      navigate("/login", {
        replace: true,
        state: {
          email: normalizedEmail,
          message: "Xác nhận email thành công. Bạn có thể đăng nhập.",
        },
      });
    } catch (error) {
      const message = String(
        error?.message || "Mã xác nhận không hợp lệ hoặc đã hết hạn.",
      );

      if (message.toUpperCase().includes("CCCD")) {
        toast.error(
          "CCCD đã được sử dụng bởi tài khoản khác. Vui lòng kiểm tra lại hoặc liên hệ bệnh viện.",
        );
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Vui lòng nhập email trước khi gửi lại mã.");
      return;
    }

    try {
      setResending(true);
      const result = await cognitoResendCode(normalizedEmail);
      const destination = result?.destination?.destination;

      sessionStorage.setItem("pendingConfirmationEmail", normalizedEmail);
      toast.success(
        destination
          ? `Đã gửi mã mới đến ${destination}.`
          : "Đã gửi lại mã. Hãy kiểm tra Inbox và Spam.",
      );
    } catch (error) {
      toast.error(error?.message || "Không thể gửi lại mã xác nhận.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Xác nhận email"
      subtitle="Nhập mã 6 số Amazon Cognito đã gửi đến email"
      icon="✉️"
      footer={
        <p>
          Đã xác nhận? <AuthLink to="/login">Quay lại đăng nhập</AuthLink>
        </p>
      }
    >
      {location.state?.destination && (
        <p className="mb-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-700">
          Mã đã được gửi đến {location.state.destination}.
        </p>
      )}

      <form onSubmit={handleConfirm}>
        <AuthInput
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@gmail.com"
          autoComplete="email"
          disabled={loading || resending}
        />

        <AuthInput
          label="Mã xác nhận"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="123456"
          inputMode="numeric"
          autoComplete="one-time-code"
          minLength={6}
          maxLength={6}
          disabled={loading || resending}
        />

        <AuthButton type="submit" loading={loading} variant="success">
          {loading ? "Đang xác nhận..." : "Xác nhận email"}
        </AuthButton>
      </form>

      <AuthButton
        type="button"
        variant="outline"
        className="mt-3"
        loading={resending}
        onClick={handleResend}
      >
        {resending ? "Đang gửi lại mã..." : "Gửi lại mã"}
      </AuthButton>
    </AuthLayout>
  );
}

export default ConfirmEmailPage;
