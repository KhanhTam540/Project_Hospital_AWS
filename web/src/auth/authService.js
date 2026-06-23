import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';

export const login = (email, password) =>
  signIn({
    username: email,
    password,
  });

export const registerPatient = (email, password, phoneNumber) =>
  signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      },
    },
  });

export const confirmPatient = (email, confirmationCode) =>
  confirmSignUp({
    username: email,
    confirmationCode,
  });

export const logout = () => signOut();

export const getSignedInUser = () => getCurrentUser();

export const getAccessToken = async () => {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() || null;
};
