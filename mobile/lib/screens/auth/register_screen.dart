import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _showPassword = false;
  bool _showConfirmPassword = false;
  bool _isLoading = false;

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
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

  Future<void> _signUp() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    if (_passwordController.text != _confirmPasswordController.text) {
      _showSnackbar('Mật khẩu xác nhận không khớp.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final result = await AuthService.instance.signUp(
        email: _emailController.text,
        password: _passwordController.text,
        fullName: _fullNameController.text,
      );

      if (!mounted) {
        return;
      }

      if (result.isSignUpComplete) {
        _showSnackbar('Đăng ký thành công. Vui lòng đăng nhập.', isError: false);
        context.go('/login');
        return;
      }

      _showSnackbar('Mã xác nhận đã được gửi đến email.', isError: false);
      context.go(
        '/confirm-email?email=${Uri.encodeQueryComponent(_emailController.text.trim())}',
      );
    } on AuthException catch (error) {
      _showSnackbar(error.message);
    } catch (error) {
      _showSnackbar(error.toString());
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      icon: Icons.person_add_alt_1_rounded,
      title: 'Tạo tài khoản',
      subtitle: 'Đăng ký tài khoản bệnh nhân bằng Amazon Cognito',
      accentColor: AppTheme.teal,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            AuthTextField(
              controller: _fullNameController,
              label: 'Họ và tên',
              icon: Icons.person_outline_rounded,
              textInputAction: TextInputAction.next,
              validator: (value) => value == null || value.trim().length < 2
                  ? 'Vui lòng nhập họ tên'
                  : null,
            ),
            const SizedBox(height: 14),
            AuthTextField(
              controller: _emailController,
              label: 'Email',
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: (value) {
                final email = value?.trim() ?? '';
                return email.isEmpty || !email.contains('@')
                    ? 'Email không hợp lệ'
                    : null;
              },
            ),
            const SizedBox(height: 14),
            AuthTextField(
              controller: _passwordController,
              label: 'Mật khẩu',
              icon: Icons.lock_outline_rounded,
              obscureText: !_showPassword,
              textInputAction: TextInputAction.next,
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
              validator: _validatePassword,
            ),
            const SizedBox(height: 14),
            AuthTextField(
              controller: _confirmPasswordController,
              label: 'Xác nhận mật khẩu',
              icon: Icons.verified_user_outlined,
              obscureText: !_showConfirmPassword,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _isLoading ? null : _signUp(),
              suffix: IconButton(
                onPressed: () => setState(
                  () => _showConfirmPassword = !_showConfirmPassword,
                ),
                icon: Icon(
                  _showConfirmPassword
                      ? Icons.visibility_rounded
                      : Icons.visibility_off_rounded,
                ),
              ),
              validator: (value) => value != _passwordController.text
                  ? 'Mật khẩu không khớp'
                  : null,
            ),
            const SizedBox(height: 20),
            AuthPrimaryButton(
              text: 'Đăng ký và gửi mã',
              isLoading: _isLoading,
              onPressed: _signUp,
              color: AppTheme.teal,
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: () => context.go('/login'),
              child: const Text('Đã có tài khoản? Đăng nhập'),
            ),
          ],
        ),
      ),
    );
  }

  String? _validatePassword(String? value) {
    final password = value ?? '';
    if (password.length < 10) {
      return 'Mật khẩu phải có ít nhất 10 ký tự';
    }
    if (!RegExp(r'[A-Z]').hasMatch(password) ||
        !RegExp(r'[a-z]').hasMatch(password) ||
        !RegExp(r'[0-9]').hasMatch(password) ||
        !RegExp(r'[^A-Za-z0-9]').hasMatch(password)) {
      return 'Cần chữ hoa, chữ thường, số và ký tự đặc biệt';
    }
    return null;
  }
}
