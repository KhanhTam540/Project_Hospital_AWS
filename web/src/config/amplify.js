import { Amplify } from "aws-amplify";
import { COGNITO_CONFIG, isCognitoEnabled } from "./cognito";

<<<<<<< HEAD
let configured = false;

export function configureAmplify() {
  if (configured || !isCognitoEnabled()) return;

  const { userPoolId, userPoolClientId } = COGNITO_CONFIG;

  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      "Thiếu VITE_COGNITO_USER_POOL_ID hoặc VITE_COGNITO_USER_POOL_CLIENT_ID trong web/.env.local",
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
        },
        signUpVerificationMethod: "code",
        userAttributes: {
          email: {
            required: true,
          },
        },
        passwordFormat: {
          minLength: 10,
          requireLowercase: true,
          requireUppercase: true,
          requireNumbers: true,
          requireSpecialCharacters: true,
        },
=======
export const configureAmplify = () => {
  if (!isCognitoEnabled()) return false;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO_CONFIG.userPoolId,
        userPoolClientId: COGNITO_CONFIG.userPoolClientId,
        loginWith: { email: true, username: true },
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
      },
    },
  });

<<<<<<< HEAD
  configured = true;
}
=======
  return true;
};
>>>>>>> 783fda1d827d49c69e82f3a6033e117577ee6a2c
