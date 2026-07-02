import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';


class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();

    try {
      final session = await Amplify.Auth.fetchAuthSession();
      if (session.isSignedIn) {
        await Amplify.Auth.signOut();
      }
    } on AuthException {
      // Không có phiên cũ cũng không ảnh hưởng đến lần đăng nhập mới.
    }

    return Amplify.Auth.signIn(
      username: normalizedEmail,
      password: password,
    );
  }

  Future<SignInResult> confirmSignIn(String confirmationValue) {
    return Amplify.Auth.confirmSignIn(
      confirmationValue: confirmationValue.trim(),
    );
  }

  Future<SignUpResult> signUp({
    required String email,
    required String password,
    required String fullName,
  }) {
    final normalizedEmail = email.trim().toLowerCase();

    return Amplify.Auth.signUp(
      username: normalizedEmail,
      password: password,
      options: SignUpOptions(
        userAttributes: {
          AuthUserAttributeKey.email: normalizedEmail,
          AuthUserAttributeKey.name: fullName.trim(),
        },
      ),
    );
  }

  Future<SignUpResult> confirmSignUp({
    required String email,
    required String confirmationCode,
  }) {
    return Amplify.Auth.confirmSignUp(
      username: email.trim().toLowerCase(),
      confirmationCode: confirmationCode.trim(),
    );
  }

  Future<ResendSignUpCodeResult> resendSignUpCode(String email) {
    return Amplify.Auth.resendSignUpCode(
      username: email.trim().toLowerCase(),
    );
  }

  Future<ResetPasswordResult> requestPasswordReset(String email) {
    return Amplify.Auth.resetPassword(
      username: email.trim().toLowerCase(),
    );
  }

  Future<ResetPasswordResult> confirmPasswordReset({
    required String email,
    required String confirmationCode,
    required String newPassword,
  }) {
    return Amplify.Auth.confirmResetPassword(
      username: email.trim().toLowerCase(),
      newPassword: newPassword,
      confirmationCode: confirmationCode.trim(),
    );
  }

  Future<UpdatePasswordResult> updatePassword({
    required String oldPassword,
    required String newPassword,
  }) {
    return Amplify.Auth.updatePassword(
      oldPassword: oldPassword,
      newPassword: newPassword,
    );
  }

  Future<void> signOut() async {
    await Amplify.Auth.signOut();
  }

  Future<bool> isSignedIn() async {
    final session = await Amplify.Auth.fetchAuthSession();
    return session.isSignedIn;
  }

  Future<String?> getIdToken() async {
    final plugin = Amplify.Auth.getPlugin(AmplifyAuthCognito.pluginKey);
    final session = await plugin.fetchAuthSession();
    if (!session.isSignedIn) return null;

    return session.userPoolTokensResult.value.idToken.raw;
  }

  String messageFor(Object error) {
    if (error is AuthException) {
      return error.message;
    }
    return error.toString();
  }
}
