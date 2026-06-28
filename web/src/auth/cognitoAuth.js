import {
  signIn,
  signUp,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";

import { jwtDecode } from "jwt-decode";
import axiosClient from "../api/axiosClient";

export const STAFF_ROLES = [
  "ADMIN",
  "BACSI",
  "NHANSU",
  "THUNGAN",
];

const ROLE_PRIORITY = [
  "ADMIN",
  "BACSI",
  "NHANSU",
  "THUNGAN",
  "BENHNHAN",
];

/*
 * Liên kết tài khoản Cognito demo với mã dữ liệu mẫu DynamoDB.
 * Các tài khoản đăng ký thực tế vẫn sử dụng Cognito sub như trước.
 */
const DEMO_PROFILE_LINKS = Object.freeze({
  "admin.demo@example.com": { maTK: "USER001" },
  "doctor.demo@example.com": { maTK: "USER002", maBS: "BS001" },
  "staff.demo@example.com": { maTK: "USER003", maNS: "NS001", loaiNS: "TN" },
  "patient.demo@example.com": { maTK: "USER004", maBN: "BN001" },
  "admin.p2tb@example.com": { maTK: "USER001" },
  "doctor.p2tb@example.com": { maTK: "USER002", maBS: "BS001" },
  "staff.p2tb@example.com": { maTK: "USER003", maNS: "NS001", loaiNS: "TN" },
  "patient.p2tb@example.com": { maTK: "USER004", maBN: "BN001" },
});

/**
 * Giải mã ID Token của Cognito.
 */
export const parseIdTokenClaims = (idToken) => {
  if (!idToken) {
    return {};
  }

  try {
    return jwtDecode(idToken);
  } catch {
    return {};
  }
};

/**
 * Xác định vai trò người dùng từ Cognito Groups
 * hoặc custom:maNhom.
 */
export const getRoleFromClaims = (claims = {}) => {
  const groups = Array.isArray(
    claims["cognito:groups"],
  )
    ? claims["cognito:groups"]
    : [];

  const customRole =
    claims["custom:maNhom"];

  for (const role of ROLE_PRIORITY) {
    if (groups.includes(role)) {
      return role;
    }
  }

  if (customRole) {
    return customRole;
  }

  return groups[0] || null;
};

/**
 * Lấy loại nhân sự.
 *
 * YT = Nhân viên y tế
 * XN = Xét nghiệm
 * TN = Tiếp nhận
 */
export const getLoaiNSFromClaims = (
  claims = {},
) => {
  const loai =
    claims["custom:loaiNS"];

  return [
    "YT",
    "XN",
    "TN",
  ].includes(loai)
    ? loai
    : "";
};

/**
 * Lưu phiên đăng nhập của ứng dụng.
 */
export const persistSession = ({
  user,
  token,
  claims,
}) => {
  localStorage.setItem(
    "token",
    token,
  );

  localStorage.setItem(
    "accessToken",
    token,
  );

  localStorage.setItem(
    "user",
    JSON.stringify(user),
  );

  if (user.maTK) {
    localStorage.setItem(
      "maTK",
      user.maTK,
    );
  }

  if (user.maNhom) {
    localStorage.setItem(
      "role",
      user.maNhom,
    );
  }

  localStorage.setItem(
    "loaiNS",
    user.loaiNS ||
      getLoaiNSFromClaims(claims) ||
      "",
  );

  localStorage.setItem(
    "authProvider",
    "cognito",
  );

  localStorage.setItem(
    "cognitoClaims",
    JSON.stringify(claims || {}),
  );

  localStorage.setItem(
    "permissions",
    JSON.stringify(
      user.permissions || [],
    ),
  );

  if (
    user.maNhom === "BENHNHAN"
  ) {
    localStorage.setItem(
      "maBN",
      user.maBN || user.maTK || "",
    );
  }

  if (
    user.maNhom === "BACSI"
  ) {
    localStorage.setItem(
      "maBS",
      user.maBS || user.maTK || "",
    );
  }
};

/**
 * Xóa toàn bộ thông tin đăng nhập local.
 */
export const clearSession = () => {
  const keys = [
    "token",
    "accessToken",
    "idToken",
    "refreshToken",
    "user",
    "maTK",
    "role",
    "loaiNS",
    "maBN",
    "maBS",
    "authProvider",
    "cognitoClaims",
    "permissions",
  ];

  for (const key of keys) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();
};

/**
 * Kiểm tra và đăng xuất phiên Cognito cũ.
 *
 * Hàm này được gọi trước mọi lần đăng nhập,
 * giúp tránh lỗi:
 * "There is already a signed in user."
 */
export const clearExistingCognitoSession =
  async () => {
    try {
      await getCurrentUser();

      await signOut({
        global: false,
      });
    } catch {
      /*
       * Không có người dùng Cognito đang
       * đăng nhập hoặc phiên cũ không còn hợp lệ.
       */
    } finally {
      clearSession();
    }
  };

/**
 * Kiểm tra lỗi người dùng đã đăng nhập
 * do Amplify trả về.
 */
const isAlreadySignedInError = (
  error,
) => {
  const message = String(
    error?.message || "",
  ).toLowerCase();

  const name = String(
    error?.name || "",
  ).toLowerCase();

  return (
    message.includes(
      "already a signed in user",
    ) ||
    message.includes(
      "already signed in",
    ) ||
    name.includes(
      "useralreadyauthenticated",
    )
  );
};

/**
 * Đăng nhập Cognito an toàn.
 *
 * Nếu Amplify vẫn phát hiện phiên cũ,
 * hàm sẽ đăng xuất và thử lại một lần.
 */
const safeCognitoSignIn = async (
  username,
  password,
) => {
  const normalizedUsername =
    String(username || "")
      .trim()
      .toLowerCase();

  if (!normalizedUsername) {
    throw new Error(
      "Vui lòng nhập email hoặc tên đăng nhập.",
    );
  }

  if (!password) {
    throw new Error(
      "Vui lòng nhập mật khẩu.",
    );
  }

  await clearExistingCognitoSession();

  try {
    return await signIn({
      username: normalizedUsername,
      password,
    });
  } catch (error) {
    if (
      !isAlreadySignedInError(error)
    ) {
      throw error;
    }

    /*
     * Trường hợp Amplify còn giữ phiên
     * trong bộ nhớ, đăng xuất và thử lại.
     */
    try {
      await signOut({
        global: false,
      });
    } catch {
      // Bỏ qua lỗi sign-out cũ.
    }

    clearSession();

    return signIn({
      username: normalizedUsername,
      password,
    });
  }
};

/**
 * Kiểm tra kết quả đăng nhập Cognito.
 */
const validateSignInResult = ({
  isSignedIn,
  nextStep,
  username,
  allowConfirmation = false,
}) => {
  const signInStep =
    nextStep?.signInStep;

  if (
    signInStep ===
    "CONFIRM_SIGN_UP"
  ) {
    if (allowConfirmation) {
      return {
        needsConfirmation: true,
        username,
      };
    }

    throw new Error(
      "Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư.",
    );
  }

  if (
    signInStep &&
    signInStep !== "DONE" &&
    !isSignedIn
  ) {
    throw new Error(
      `Cognito yêu cầu bước xác thực bổ sung: ${signInStep}`,
    );
  }

  return null;
};

/**
 * Đăng nhập bệnh nhân.
 */
export const cognitoSignIn = async (
  username,
  password,
) => {
  const result =
    await safeCognitoSignIn(
      username,
      password,
    );

  const pendingResult =
    validateSignInResult({
      ...result,
      username,
      allowConfirmation: true,
    });

  if (pendingResult) {
    return pendingResult;
  }

  return syncWithBackend();
};

/**
 * Đăng ký Cognito.
 */
export const cognitoSignUp = async ({
  email,
  password,
  name,
}) => {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Vui lòng nhập email.",
    );
  }

  return signUp({
    username: normalizedEmail,
    password,

    options: {
      userAttributes: {
        email: normalizedEmail,

        name:
          name?.trim() ||
          normalizedEmail.split("@")[0],
      },
    },
  });
};

/**
 * Xác nhận đăng ký bằng mã Cognito.
 */
export const cognitoConfirmSignUp =
  async (
    email,
    confirmationCode,
  ) => {
    return confirmSignUp({
      username: String(email)
        .trim()
        .toLowerCase(),

      confirmationCode:
        String(
          confirmationCode,
        ).trim(),
    });
  };

/**
 * Gửi lại mã xác nhận.
 */
export const cognitoResendCode =
  async (email) => {
    return resendSignUpCode({
      username: String(email)
        .trim()
        .toLowerCase(),
    });
  };

/**
 * Yêu cầu đặt lại mật khẩu.
 */
export const cognitoForgotPassword =
  async (email) => {
    return resetPassword({
      username: String(email)
        .trim()
        .toLowerCase(),
    });
  };

/**
 * Xác nhận mật khẩu mới.
 */
export const
  cognitoConfirmResetPassword =
    async (
      email,
      confirmationCode,
      newPassword,
    ) => {
      return confirmResetPassword({
        username: String(email)
          .trim()
          .toLowerCase(),

        confirmationCode:
          String(
            confirmationCode,
          ).trim(),

        newPassword,
      });
    };

/**
 * Đồng bộ phiên Cognito với cấu trúc
 * dữ liệu người dùng của frontend.
 */
export const syncWithBackend = async ({
  staffOnly = false,
} = {}) => {
  const session = await fetchAuthSession();

  const accessToken = session.tokens?.accessToken?.toString();
  const idToken = session.tokens?.idToken?.toString();

  if (!accessToken) {
    throw new Error("Không lấy được Access Token Cognito.");
  }
  if (!idToken) {
    throw new Error("Không lấy được ID Token Cognito.");
  }

  const claims = parseIdTokenClaims(idToken);
  const role = getRoleFromClaims(claims);

  if (!role) {
    await cognitoSignOut();
    throw new Error(
      "Tài khoản chưa được gán nhóm Cognito: ADMIN, BACSI, NHANSU, THUNGAN hoặc BENHNHAN.",
    );
  }

  if (staffOnly && !STAFF_ROLES.includes(role)) {
    await cognitoSignOut();
    throw new Error("Tài khoản không thuộc cổng nhân viên nội bộ.");
  }

  const subject =
    claims.sub ||
    claims["cognito:username"] ||
    claims.email;

  if (!subject) {
    await cognitoSignOut();
    throw new Error("Không xác định được mã người dùng Cognito.");
  }

  const normalizedEmail = String(claims.email || "")
    .trim()
    .toLowerCase();
  const demoLink = DEMO_PROFILE_LINKS[normalizedEmail] || {};

  // API /auth/me cần access token. Lưu tạm token trước khi gọi API,
  // sau đó persistSession sẽ ghi lại toàn bộ phiên hoàn chỉnh.
  localStorage.setItem("token", accessToken);
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("idToken", idToken);

  let backendProfile = {};
  try {
    const response = await axiosClient.get("/auth/me");
    backendProfile = response?.data?.data ?? response?.data ?? {};
  } catch (error) {
    console.warn(
      "Không đồng bộ được hồ sơ ứng dụng từ /auth/me, dùng dữ liệu Cognito tạm thời.",
      error,
    );
  }

  const resolvedRole =
    backendProfile.maNhom ||
    backendProfile.primaryRole ||
    role;

  if (staffOnly && !STAFF_ROLES.includes(resolvedRole)) {
    await cognitoSignOut();
    throw new Error("Tài khoản không thuộc cổng nhân viên nội bộ.");
  }

  const loaiNS =
    backendProfile.loaiNS ||
    demoLink.loaiNS ||
    getLoaiNSFromClaims(claims) ||
    (resolvedRole === "NHANSU" ? "TN" : "");

  const displayName =
    backendProfile.hoTen ||
    backendProfile.fullName ||
    claims.name ||
    claims.email ||
    claims["cognito:username"] ||
    "Hospital P2TB User";

  const user = {
    maTK:
      backendProfile.maTK ||
      backendProfile.appUserId ||
      demoLink.maTK ||
      subject,
    cognitoSub: subject,
    email: backendProfile.email || claims.email || "",
    hoTen: displayName,
    HoTen: displayName,
    maNhom: resolvedRole,
    loaiNS,
    maBN:
      resolvedRole === "BENHNHAN"
        ? (
            backendProfile.maBN ||
            backendProfile.patientId ||
            demoLink.maBN ||
            subject
          )
        : undefined,
    maBS:
      resolvedRole === "BACSI"
        ? (
            backendProfile.maBS ||
            backendProfile.doctorId ||
            demoLink.maBS ||
            subject
          )
        : undefined,
    maNS:
      resolvedRole === "NHANSU"
        ? (
            backendProfile.maNS ||
            backendProfile.staffId ||
            demoLink.maNS ||
            subject
          )
        : undefined,
    permissions: backendProfile.permissions || [],
  };

  persistSession({
    user,
    token: accessToken,
    claims,
  });

  localStorage.setItem("idToken", idToken);

  return {
    user,
    claims,
    backendProfile,
    legacyToken: accessToken,
  };
};

/**
 * Đăng nhập nhân viên nội bộ.
 */
export const cognitoStaffSignIn =
  async (
    username,
    password,
  ) => {
    const result =
      await safeCognitoSignIn(
        username,
        password,
      );

    validateSignInResult({
      ...result,
      username,
      allowConfirmation: false,
    });

    return syncWithBackend({
      staffOnly: true,
    });
  };

/**
 * Đăng xuất Cognito và xóa dữ liệu local.
 */
export const cognitoSignOut =
  async () => {
    try {
      await signOut({
        global: false,
      });
    } catch {
      /*
       * Dù Cognito sign-out lỗi,
       * vẫn phải xóa phiên local.
       */
    } finally {
      clearSession();
    }
  };

/**
 * Lấy phiên Cognito hiện tại.
 */
export const getCognitoSession =
  async () => {
    try {
      await getCurrentUser();

      const session =
        await fetchAuthSession();

      if (
        !session.tokens
          ?.accessToken
      ) {
        return null;
      }

      return session;
    } catch {
      return null;
    }
  };

/**
 * Kiểm tra vai trò nhân viên.
 */
export const isStaffRole = (
  role,
) => {
  return STAFF_ROLES.includes(role);
};

