import { Amplify } from "aws-amplify";
import { COGNITO_CONFIG, isCognitoEnabled } from "./cognito";

export const configureAmplify = () => {
  if (!isCognitoEnabled()) return false;

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO_CONFIG.userPoolId,
        userPoolClientId: COGNITO_CONFIG.userPoolClientId,
        loginWith: { email: true, username: true },
      },
    },
  });

  return true;
};
