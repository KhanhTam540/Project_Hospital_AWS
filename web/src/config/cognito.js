export const COGNITO_CONFIG = {
  region: import.meta.env.VITE_COGNITO_REGION || "ap-southeast-1",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
<<<<<<< HEAD
  userPoolClientId:
    import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID ||
    import.meta.env.VITE_COGNITO_CLIENT_ID ||
    "",
};

const PLACEHOLDER_RE = /your-|xxxxxxxx|example|changeme|placeholder/i;
=======
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
};

/** Giá trị placeholder trong .env.example — chưa cấu hình Cognito thật */
const PLACEHOLDER_RE = /your-|XXXXXXXX|example|changeme|placeholder/i;
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c

const isRealCognitoValue = (value) =>
  Boolean(value && typeof value === "string" && !PLACEHOLDER_RE.test(value));

<<<<<<< HEAD
export const isCognitoEnabled = () => {
  if (import.meta.env.VITE_COGNITO_ENABLED === "false") return false;

=======
/** Cognito chỉ bật khi có User Pool + Client ID thật (không phải mẫu) */
export const isCognitoEnabled = () => {
  if (import.meta.env.VITE_COGNITO_ENABLED === "false") return false;
  if (import.meta.env.VITE_COGNITO_ENABLED === "true") {
    return (
      isRealCognitoValue(COGNITO_CONFIG.userPoolId) &&
      isRealCognitoValue(COGNITO_CONFIG.userPoolClientId)
    );
  }
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
  return (
    isRealCognitoValue(COGNITO_CONFIG.userPoolId) &&
    isRealCognitoValue(COGNITO_CONFIG.userPoolClientId)
  );
};
