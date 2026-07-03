import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, this.initialEmail = ''});

  final String initialEmail;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailFormKey = GlobalKey<FormState>();
  final _resetFormKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  final _codeController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _waitingForCode = false;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _codeController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _showSnackbar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.danger : AppTheme.teal,
      ),
    );
  }

  Future<void> _requestReset() async {
    if (!_emailFormKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      await AuthService.instance.requestPasswordReset(_emailController.text);
      if (!mounted) return;
      setState(() => _waitingForCode = true);
      _showSnackbar('Đã gửi mã xác nhận đến email.', isError: false);
    } on AuthException catch (error) {
      _showSnackbar(error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _confirmReset() async {
    if (!_resetFormKey.currentState!.validate()) return;
    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showSnackbar('Mật khẩu xác nhận không khớp.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      await AuthService.instance.confirmPasswordReset(
        email: _emailController.text,
        confirmationCode: _codeController.text,
        newPassword: _newPasswordController.text,
      );

      if (!mounted) return;
      _showSnackbar('Đặt lại mật khẩu thành công.', isError: false);
      context.go('/login');
    } on AuthException catch (error) {
      _showSnackbar(error.message);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      icon: Icons.lock_reset_rounded,
      title: 'Quên mật khẩu',
      subtitle: 'Khôi phục mật khẩu qua Amazon Cognito',
      child: _waitingForCode
          ? _buildResetForm(context)
          : _buildEmailForm(context),
    );
  }

  Widget _buildEmailForm(BuildContext context) {
    return Form(
      key: _emailFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          AuthTextField(
            controller: _emailController,
            label: 'Email đăng ký',
            icon: Icons.mail_outline_rounded,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _isLoading ? null : _requestReset(),
            validator: (value) {
              final email = value?.trim() ?? '';
              return email.isEmpty || !email.contains('@')
                  ? 'Email không hợp lệ'
                  : null;
            },
          ),
          const SizedBox(height: 20),
          AuthPrimaryButton(
            text: 'Gửi mã xác nhận',
            isLoading: _isLoading,
            onPressed: _requestReset,
          ),
          TextButton(
            onPressed: () => context.go('/login'),
            child: const Text('Quay lại đăng nhập'),
          ),
        ],
      ),
    );
  }

  Widget _buildResetForm(BuildContext context) {
    return Form(
      key: _resetFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Mã xác nhận đã gửi đến ${_emailController.text.trim()}.',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 18),
          AuthTextField(
            controller: _codeController,
            label: 'Mã xác nhận',
            icon: Icons.pin_outlined,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            validator: (value) => value == null || value.trim().length < 6
                ? 'Mã xác nhận không hợp lệ'
                : null,
          ),
          const SizedBox(height: 14),
          AuthTextField(
            controller: _newPasswordController,
            label: 'Mật khẩu mới',
            icon: Icons.lock_outline_rounded,
            obscureText: true,
            textInputAction: TextInputAction.next,
            validator: _validatePassword,
          ),
          const SizedBox(height: 14),
          AuthTextField(
            controller: _confirmPasswordController,
            label: 'Xác nhận mật khẩu mới',
            icon: Icons.verified_user_outlined,
            obscureText: true,
            textInputAction: TextInputAction.done,
            onFieldSubmitted: (_) => _isLoading ? null : _confirmReset(),
            validator: (value) => value != _newPasswordController.text
                ? 'Mật khẩu không khớp'
                : null,
          ),
          const SizedBox(height: 20),
          AuthPrimaryButton(
            text: 'Đặt lại mật khẩu',
            isLoading: _isLoading,
            onPressed: _confirmReset,
            color: AppTheme.teal,
          ),
          TextButton(
            onPressed: _isLoading
                ? null
                : () => setState(() => _waitingForCode = false),
            child: const Text('Đổi email'),
          ),
        ],
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
