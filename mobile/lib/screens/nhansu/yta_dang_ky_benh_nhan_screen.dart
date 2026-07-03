// lib/screens/nhansu/yta_dang_ky_benh_nhan_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:font_awesome_flutter/font_awesome_flutter.dart'; // Thêm import
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

class DangKyBenhNhanYtaScreen extends StatefulWidget {
  const DangKyBenhNhanYtaScreen({super.key});

  @override
  State<DangKyBenhNhanYtaScreen> createState() =>
      _DangKyBenhNhanYtaScreenState();
}

class _DangKyBenhNhanYtaScreenState extends State<DangKyBenhNhanYtaScreen> {
  // (Giữ nguyên toàn bộ logic state, controllers, dispose, _handleSubmit, _showError)
  final _formKey = GlobalKey<FormState>();
  final ApiClient _api = ApiClient();
  bool _isLoading = false;

  final _tenDangNhap = TextEditingController();
  final _matKhau = TextEditingController();
  final _email = TextEditingController();
  final _hoTen = TextEditingController();
  final _soDienThoai = TextEditingController();
  final _diaChi = TextEditingController();
  final _bhyt = TextEditingController();
  String? _gioiTinh;
  DateTime? _ngaySinh;

  @override
  void dispose() {
    _tenDangNhap.dispose();
    _matKhau.dispose();
    _email.dispose();
    _hoTen.dispose();
    _soDienThoai.dispose();
    _diaChi.dispose();
    _bhyt.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final payload = {
        'tenDangNhap': _tenDangNhap.text,
        'matKhau': _matKhau.text,
        'email': _email.text.isEmpty ? null : _email.text,
        'hoTen': _hoTen.text,
        'ngaySinh': _ngaySinh?.toIso8601String().split('T').first,
        'gioiTinh': _gioiTinh,
        'diaChi': _diaChi.text,
        'soDienThoai': _soDienThoai.text,
        'bhyt': _bhyt.text.isEmpty ? null : _bhyt.text,
      };

      // API backend: POST /api/tai-khoan/dangky-benhnhan
      final response = await _api.post('/tai-khoan/dangky-benhnhan', payload);

      if (!mounted) return;

      if (response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Đăng ký bệnh nhân thành công!'),
            backgroundColor: Colors.green,
          ),
        );
        _formKey.currentState?.reset();
        _tenDangNhap.clear();
        _matKhau.clear();
        _email.clear();
        _hoTen.clear();
        _soDienThoai.clear();
        _diaChi.clear();
        _bhyt.clear();
        setState(() {
          _gioiTinh = null;
          _ngaySinh = null;
        });
      } else {
        final errorBody = jsonDecode(response.body);
        _showError('Lỗi: ${errorBody['message'] ?? 'Không thể tạo bệnh nhân'}');
      }
    } catch (e) {
      if (!mounted) return;
      _showError('Lỗi kết nối: $e');
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    // SỬA: Thêm Scaffold và AppBar
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Đăng ký Bệnh nhân'),
        backgroundColor: Color(0xFF166534), // Màu Y tá
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/yta'),
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'Đăng xuất',
            onPressed: () async {
              await Provider.of<AuthProvider>(context, listen: false).logout();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // (Giữ nguyên toàn bộ nội dung Form)
              Text(
                '👥 Thông tin tài khoản',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 16),
              _buildTextField('Tên đăng nhập', controller: _tenDangNhap),
              _buildTextField(
                'Mật khẩu',
                controller: _matKhau,
                isPassword: true,
                validator: (v) => v != null && v.length < 6
                    ? 'Mật khẩu tối thiểu 6 ký tự'
                    : null,
              ),
              _buildTextField(
                'Email',
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                isRequired: false,
              ),

              SizedBox(height: 24),
              Text(
                '🩺 Thông tin cá nhân',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 16),
              _buildTextField('Họ tên', controller: _hoTen),
              _buildDateField(
                context,
                'Ngày sinh',
                _ngaySinh,
                (v) => setState(() => _ngaySinh = v),
              ),
              _buildDropdown(
                'Giới tính',
                ['Nam', 'Nữ', 'Khác'],
                _gioiTinh,
                (v) => setState(() => _gioiTinh = v),
              ),
              _buildTextField(
                'Số điện thoại',
                controller: _soDienThoai,
                keyboardType: TextInputType.phone,
              ),
              _buildTextField('Địa chỉ', controller: _diaChi),
              _buildTextField(
                'Số thẻ BHYT (nếu có)',
                controller: _bhyt,
                isRequired: false,
              ),

              SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _isLoading ? null : _handleSubmit,
                icon: _isLoading
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 3),
                      )
                    : Icon(Icons.person_add),
                label: Text('Tạo hồ sơ bệnh nhân'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 16),
                  textStyle: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // (Giữ nguyên 3 hàm helper: _buildTextField, _buildDropdown, _buildDateField)
  Widget _buildTextField(
    String label, {
    TextEditingController? controller,
    bool isPassword = false,
    String? hint,
    bool isRequired = true,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
    bool readOnly = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: TextFormField(
        controller: controller,
        readOnly: readOnly,
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: OutlineInputBorder(),
          suffixIcon: isPassword ? Icon(Icons.visibility) : null,
        ),
        obscureText: isPassword,
        validator:
            validator ??
            (value) {
              if (isRequired && (value == null || value.isEmpty)) {
                return '$label là bắt buộc';
              }
              return null;
            },
      ),
    );
  }

  Widget _buildDropdown(
    String label,
    List<String> items,
    String? currentValue,
    Function(String?) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: DropdownButtonFormField<String>(
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(),
        ),
        initialValue: currentValue,
        items: items
            .map(
              (item) =>
                  DropdownMenuItem<String>(value: item, child: Text(item)),
            )
            .toList(),
        onChanged: onChanged,
        validator: (v) =>
            v == null || v.isEmpty ? 'Vui lòng chọn $label' : null,
      ),
    );
  }

  Widget _buildDateField(
    BuildContext context,
    String label,
    DateTime? date,
    Function(DateTime?) onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: TextFormField(
        readOnly: true,
        controller: TextEditingController(
          text: date == null ? '' : DateFormat('dd/MM/yyyy').format(date),
        ),
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(),
          suffixIcon: Icon(Icons.calendar_today),
        ),
        onTap: () async {
          DateTime? picked = await showDatePicker(
            context: context,
            initialDate: date ?? DateTime.now(),
            firstDate: DateTime(1900),
            lastDate: DateTime.now(),
          );
          if (picked != null) onChanged(picked);
        },
        validator: (v) => (v == null || v.isEmpty) && label == 'Ngày sinh'
            ? '$label là bắt buộc'
            : null, // Sửa: Chỉ validate nếu là 'Ngày sinh'
      ),
    );
  }
}
