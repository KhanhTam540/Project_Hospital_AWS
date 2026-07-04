import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../services/auth_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class ThongTinCaNhanScreen extends StatefulWidget {
  const ThongTinCaNhanScreen({super.key});

  @override
  State<ThongTinCaNhanScreen> createState() => _ThongTinCaNhanScreenState();
}

class _ThongTinCaNhanScreenState extends State<ThongTinCaNhanScreen> {
  final ApiClient _api = ApiClient();
  final GlobalKey<FormState> _profileFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _passwordFormKey = GlobalKey<FormState>();

  final TextEditingController _fullName = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _address = TextEditingController();
  final TextEditingController _insurance = TextEditingController();
  final TextEditingController _oldPassword = TextEditingController();
  final TextEditingController _newPassword = TextEditingController();
  final TextEditingController _confirmPassword = TextEditingController();

  bool _isLoading = true;
  bool _isSaving = false;
  bool _isChangingPassword = false;
  String? _error;
  String _gender = 'KHAC';
  DateTime? _dateOfBirth;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _fullName.dispose();
    _phone.dispose();
    _address.dispose();
    _insurance.dispose();
    _oldPassword.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    final patientId = auth.maBN;
    if (patientId == null || patientId.isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Tài khoản chưa được liên kết với hồ sơ bệnh nhân.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get('/benhnhan/$patientId');
      final data = Map<String, dynamic>.from(_api.dataOf(response) as Map);
      if (!mounted) return;
      setState(() {
        _fullName.text =
            _text(data['hoTen'] ?? data['fullName']) ?? auth.tenDangNhap ?? '';
        _phone.text = _text(data['soDienThoai'] ?? data['phoneNumber']) ?? '';
        _address.text = _text(data['diaChi'] ?? data['address']) ?? '';
        _insurance.text =
            _text(data['bhyt'] ?? data['healthInsuranceNumber']) ?? '';
        _gender = _normalizeGender(data['gioiTinh'] ?? data['gender']);
        _dateOfBirth = DateTime.tryParse(
          _text(data['ngaySinh'] ?? data['dateOfBirth']) ?? '',
        );
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải thông tin cá nhân: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_profileFormKey.currentState!.validate()) return;
    final patientId = context.read<AuthProvider>().maBN;
    if (patientId == null || patientId.isEmpty) {
      _showMessage('Không tìm thấy mã bệnh nhân.');
      return;
    }

    setState(() => _isSaving = true);
    try {
      final response = await _api.put('/benhnhan/$patientId', {
        'hoTen': _fullName.text.trim(),
        'soDienThoai': _phone.text.trim(),
        'diaChi': _address.text.trim(),
        'bhyt': _insurance.text.trim(),
        'gioiTinh': _gender,
        'ngaySinh': _dateOfBirth == null
            ? null
            : DateFormat('yyyy-MM-dd').format(_dateOfBirth!),
      });
      _api.dataOf(response);
      if (!mounted) return;
      _showMessage('Cập nhật thông tin thành công.', isError: false);
      await context.read<AuthProvider>().refreshProfile();
    } catch (error) {
      _showMessage('Không thể cập nhật thông tin: $error');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _changePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;
    if (_newPassword.text != _confirmPassword.text) {
      _showMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setState(() => _isChangingPassword = true);
    try {
      await context.read<AuthProvider>().changePassword(
        oldPassword: _oldPassword.text,
        newPassword: _newPassword.text,
      );
      if (!mounted) return;
      _oldPassword.clear();
      _newPassword.clear();
      _confirmPassword.clear();
      _showMessage('Đổi mật khẩu thành công.', isError: false);
    } catch (error) {
      _showMessage(AuthService.instance.messageFor(error));
    } finally {
      if (mounted) setState(() => _isChangingPassword = false);
    }
  }

  Future<void> _pickDate() async {
    final result = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      locale: const Locale('vi', 'VN'),
    );
    if (result != null && mounted) {
      setState(() => _dateOfBirth = result);
    }
  }

  void _showMessage(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.danger : AppTheme.teal,
      ),
    );
  }

  String? _text(dynamic value) {
    final result = value?.toString().trim();
    return result == null || result.isEmpty ? null : result;
  }

  String _normalizeGender(dynamic value) {
    final text = _text(value)?.toUpperCase() ?? 'KHAC';
    if (text == 'NAM') return 'NAM';
    if (text == 'NU' || text == 'NỮ') return 'NU';
    return 'KHAC';
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thông tin cá nhân'),
        actions: [
          IconButton(
            tooltip: 'Đăng xuất',
            onPressed: () async {
              await auth.logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            AppCard(
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 34,
                    child: Icon(Icons.person_rounded, size: 38),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    auth.tenDangNhap ?? _fullName.text,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(auth.email ?? 'Chưa có email'),
                  const SizedBox(height: 4),
                  Text('Mã bệnh nhân: ${auth.maBN ?? 'Chưa liên kết'}'),
                ],
              ),
            ),
            const SizedBox(height: 18),
            if (_isLoading)
              const Center(child: CircularProgressIndicator())
            else if (_error != null)
              AppCard(
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppTheme.danger),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              )
            else ...[
              _buildProfileForm(),
              const SizedBox(height: 18),
              _buildPasswordForm(),
            ],
          ],
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 3),
    );
  }

  Widget _buildProfileForm() {
    return AppCard(
      child: Form(
        key: _profileFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Hồ sơ bệnh nhân',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _fullName,
              decoration: const InputDecoration(labelText: 'Họ và tên'),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Vui lòng nhập họ tên'
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Số điện thoại'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _address,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Địa chỉ'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _insurance,
              decoration: const InputDecoration(labelText: 'Mã BHYT'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _gender,
              decoration: const InputDecoration(labelText: 'Giới tính'),
              items: const [
                DropdownMenuItem<String>(value: 'NAM', child: Text('Nam')),
                DropdownMenuItem<String>(value: 'NU', child: Text('Nữ')),
                DropdownMenuItem<String>(value: 'KHAC', child: Text('Khác')),
              ],
              onChanged: (value) => setState(() => _gender = value ?? 'KHAC'),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickDate,
              icon: const Icon(Icons.cake_outlined),
              label: Text(
                _dateOfBirth == null
                    ? 'Chọn ngày sinh'
                    : 'Ngày sinh: ${DateFormat('dd/MM/yyyy').format(_dateOfBirth!)}',
              ),
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _isSaving ? null : _saveProfile,
              icon: _isSaving
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_isSaving ? 'Đang lưu...' : 'Lưu thông tin'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordForm() {
    return AppCard(
      child: Form(
        key: _passwordFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Đổi mật khẩu', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 14),
            TextFormField(
              controller: _oldPassword,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
              validator: (value) => value == null || value.isEmpty
                  ? 'Vui lòng nhập mật khẩu hiện tại'
                  : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _newPassword,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
              validator: _validatePassword,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _confirmPassword,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Xác nhận mật khẩu mới',
              ),
              validator: (value) => value != _newPassword.text
                  ? 'Mật khẩu xác nhận không khớp'
                  : null,
            ),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: _isChangingPassword ? null : _changePassword,
              icon: const Icon(Icons.password_outlined),
              label: Text(_isChangingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'),
            ),
          ],
        ),
      ),
    );
  }
}
