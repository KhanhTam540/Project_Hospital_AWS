import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/auth_widgets.dart';

class ConfirmEmailScreen extends StatefulWidget {
  const ConfirmEmailScreen({super.key, required this.initialEmail});

  final String initialEmail;

  @override
  State<ConfirmEmailScreen> createState() => _ConfirmEmailScreenState();
}

class _ConfirmEmailScreenState extends State<ConfirmEmailScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  final _codeController = TextEditingController();
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

  Future<void> _confirm() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() => _isLoading = true);
    try {
      final result = await AuthService.instance.confirmSignUp(
        email: _emailController.text,
        confirmationCode: _codeController.text,
      );
      if (!mounted) {
        return;
      }
      if (!result.isSignUpComplete) {
        _showSnackbar('Tài khoản vẫn chưa được xác nhận.');
        return;
      }
      _showSnackbar(
        'Xác nhận email thành công. Vui lòng đăng nhập.',
        isError: false,
      );
      context.go('/login');
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

  Future<void> _resend() async {
    final email = _emailController.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      _showSnackbar('Vui lòng nhập email hợp lệ.');
      return;
    }

    setState(() => _isLoading = true);
    try {
      await AuthService.instance.resendSignUpCode(email);
      _showSnackbar('Đã gửi lại mã xác nhận.', isError: false);
    } on AuthException catch (error) {
      _showSnackbar(error.message);
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      icon: Icons.mark_email_read_rounded,
      title: 'Xác nhận email',
      subtitle: 'Nhập mã Amazon Cognito đã gửi đến hộp thư của bạn',
      accentColor: AppTheme.teal,
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            AuthTextField(
              controller: _emailController,
              label: 'Email đăng ký',
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
              controller: _codeController,
              label: 'Mã xác nhận',
              icon: Icons.pin_outlined,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _isLoading ? null : _confirm(),
              validator: (value) => value == null || value.trim().length < 6
                  ? 'Mã xác nhận không hợp lệ'
                  : null,
            ),
            const SizedBox(height: 20),
            AuthPrimaryButton(
              text: 'Xác nhận tài khoản',
              isLoading: _isLoading,
              onPressed: _confirm,
              color: AppTheme.teal,
            ),
            TextButton(
              onPressed: _isLoading ? null : _resend,
              child: const Text('Gửi lại mã'),
            ),
            TextButton(
              onPressed: () => context.go('/login'),
              child: const Text('Quay lại đăng nhập'),
            ),
          ],
        ),
      ),
    );
  }
}
