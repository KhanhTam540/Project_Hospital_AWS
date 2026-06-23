import { Amplify } from 'aws-amplify';

const region = import.meta.env.VITE_AWS_REGION;
const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const userPoolClientId = import.meta.env.VITE_COGNITO_WEB_CLIENT_ID;

if (!region || !userPoolId || !userPoolClientId) {
  console.warn(
    'Thiếu cấu hình Cognito. Hãy tạo web/.env.local hoặc chạy npm run outputs sau khi deploy.',
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
      signUpVerificationMethod: 'code',
      allowGuestAccess: false,
    },
  },
});
