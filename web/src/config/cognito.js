export const COGNITO_CONFIG = {
  region: import.meta.env.VITE_COGNITO_REGION || "ap-southeast-1",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || "",
};

/** Giá trị placeholder trong .env.example — chưa cấu hình Cognito thật */
const PLACEHOLDER_RE = /your-|XXXXXXXX|example|changeme|placeholder/i;

const isRealCognitoValue = (value) =>
  Boolean(value && typeof value === "string" && !PLACEHOLDER_RE.test(value));

/** Cognito chỉ bật khi có User Pool + Client ID thật (không phải mẫu) */
export const isCognitoEnabled = () => {
  if (import.meta.env.VITE_COGNITO_ENABLED === "false") return false;
  if (import.meta.env.VITE_COGNITO_ENABLED === "true") {
    return (
      isRealCognitoValue(COGNITO_CONFIG.userPoolId) &&
      isRealCognitoValue(COGNITO_CONFIG.userPoolClientId)
    );
  }
  return (
    isRealCognitoValue(COGNITO_CONFIG.userPoolId) &&
    isRealCognitoValue(COGNITO_CONFIG.userPoolClientId)
  );
};
