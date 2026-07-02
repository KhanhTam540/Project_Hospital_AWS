import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _showPassword = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _showSnackbar(String message, {bool isError = true}) {
    if (!mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.danger : AppTheme.teal,
      ),
    );
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);

    try {
      final auth = context.read<AuthProvider>();
      var nextStep = await auth.signIn(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      while (nextStep != null) {
        if (!mounted) {
          return;
        }

        final stepName = nextStep.name;
        if (stepName == 'confirmSignUp') {
          context.go(
            '/confirm-email?email=${Uri.encodeQueryComponent(_emailController.text.trim())}',
          );
          return;
        }
        if (stepName == 'resetPassword') {
          context.go(
            '/forgot-password?email=${Uri.encodeQueryComponent(_emailController.text.trim())}',
          );
          return;
        }

        final confirmationValue = await _promptForSignInStep(stepName);
        if (confirmationValue == null || confirmationValue.trim().isEmpty) {
          throw StateError('Quá trình xác thực bổ sung đã bị hủy.');
        }
        nextStep = await auth.confirmSignIn(confirmationValue);
      }

      if (!mounted) {
        return;
      }
      _showSnackbar('Đăng nhập thành công.', isError: false);
      context.go('/home');
    } catch (error) {
      _showSnackbar(AuthService.instance.messageFor(error));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<String?> _promptForSignInStep(String stepName) async {
    final controller = TextEditingController();
    final isNewPassword = stepName == 'confirmSignInWithNewPassword';
    final isMfaSelection = stepName == 'continueSignInWithMfaSelection' ||
        stepName == 'continueSignInWithMfaSetupSelection';

    final title = isNewPassword
        ? 'Đặt mật khẩu mới'
        : isMfaSelection
            ? 'Chọn phương thức MFA'
            : 'Xác nhận đăng nhập';
    final hint = isNewPassword
        ? 'Nhập mật khẩu mới'
        : isMfaSelection
            ? 'Nhập EMAIL, SMS hoặc TOTP'
            : 'Nhập mã OTP/MFA';

    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          obscureText: isNewPassword,
          keyboardType: isNewPassword
              ? TextInputType.visiblePassword
              : TextInputType.text,
          autofocus: true,
          decoration: InputDecoration(
            labelText: hint,
            helperText: 'Bước Cognito: $stepName',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(
              dialogContext,
              controller.text.trim(),
            ),
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );

    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      icon: Icons.local_hospital_rounded,
      title: 'Hospital P2TB',
      subtitle: 'Đăng nhập để sử dụng dữ liệu thật từ AWS backend',
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Đăng nhập tài khoản',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 22),
            AuthTextField(
              controller: _emailController,
              label: 'Email',
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: (value) {
                final email = value?.trim() ?? '';
                if (email.isEmpty || !email.contains('@')) {
                  return 'Vui lòng nhập email hợp lệ';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            AuthTextField(
              controller: _passwordController,
              label: 'Mật khẩu',
              icon: Icons.lock_outline_rounded,
              obscureText: !_showPassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _isLoading ? null : _handleLogin(),
              suffix: IconButton(
                onPressed: () => setState(
                  () => _showPassword = !_showPassword,
                ),
                icon: Icon(
                  _showPassword
                      ? Icons.visibility_rounded
                      : Icons.visibility_off_rounded,
                ),
              ),
              validator: (value) => value == null || value.isEmpty
                  ? 'Vui lòng nhập mật khẩu'
                  : null,
            ),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => context.go(
                  '/forgot-password?email=${Uri.encodeQueryComponent(_emailController.text.trim())}',
                ),
                child: const Text('Quên mật khẩu?'),
              ),
            ),
            const SizedBox(height: 12),
            AuthPrimaryButton(
              text: 'Đăng nhập',
              isLoading: _isLoading,
              onPressed: _handleLogin,
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'Chưa có tài khoản?',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                TextButton(
                  onPressed: () => context.go('/register'),
                  child: const Text('Đăng ký ngay'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
