export const COGNITO_CONFIG = {
  region: import.meta.env.VITE_COGNITO_REGION || "ap-southeast-1",
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
  userPoolClientId:
    import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID ||
    import.meta.env.VITE_COGNITO_CLIENT_ID ||
    "",
};

const PLACEHOLDER_RE = /your-|xxxxxxxx|example|changeme|placeholder/i;

const isRealCognitoValue = (value) =>
  Boolean(value && typeof value === "string" && !PLACEHOLDER_RE.test(value));

export const isCognitoEnabled = () => {
  if (import.meta.env.VITE_COGNITO_ENABLED === "false") return false;

  return (
    isRealCognitoValue(COGNITO_CONFIG.userPoolId) &&
    isRealCognitoValue(COGNITO_CONFIG.userPoolClientId)
  );
};
