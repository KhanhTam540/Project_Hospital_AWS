// lib/screens/nhansu/yta_dang_ky_benh_nhan_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:font_awesome_flutter/font_awesome_flutter.dart'; // ThÃªm import
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';

class DangKyBenhNhanYtaScreen extends StatefulWidget {
  const DangKyBenhNhanYtaScreen({super.key});

  @override
  State<DangKyBenhNhanYtaScreen> createState() =>
      _DangKyBenhNhanYtaScreenState();
}

class _DangKyBenhNhanYtaScreenState extends State<DangKyBenhNhanYtaScreen> {
  // (Giá»¯ nguyÃªn toÃ n bá»™ logic state, controllers, dispose, _handleSubmit, _showError)
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
            content: Text('âœ… ÄÄƒng kÃ½ bá»‡nh nhÃ¢n thÃ nh cÃ´ng!'),
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
        _showError(
          'Lá»—i: ${errorBody['message'] ?? 'KhÃ´ng thá»ƒ táº¡o bá»‡nh nhÃ¢n'}',
        );
      }
    } catch (e) {
      if (!mounted) return;
      _showError('Lá»—i káº¿t ná»‘i: $e');
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
    // Sá»¬A: ThÃªm Scaffold vÃ  AppBar
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('ÄÄƒng kÃ½ Bá»‡nh nhÃ¢n'),
        backgroundColor: Color(0xFF166534), // MÃ u Y tÃ¡
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/yta'),
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'ÄÄƒng xuáº¥t',
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
              // (Giá»¯ nguyÃªn toÃ n bá»™ ná»™i dung Form)
              Text(
                'ðŸ‘¥ ThÃ´ng tin tÃ i khoáº£n',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 16),
              _buildTextField('TÃªn Ä‘Äƒng nháº­p', controller: _tenDangNhap),
              _buildTextField(
                'Máº­t kháº©u',
                controller: _matKhau,
                isPassword: true,
                validator: (v) => v != null && v.length < 6
                    ? 'Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±'
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
                'ðŸ©º ThÃ´ng tin cÃ¡ nhÃ¢n',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 16),
              _buildTextField('Há» tÃªn', controller: _hoTen),
              _buildDateField(
                context,
                'NgÃ y sinh',
                _ngaySinh,
                (v) => setState(() => _ngaySinh = v),
              ),
              _buildDropdown(
                'Giá»›i tÃ­nh',
                ['Nam', 'Ná»¯', 'KhÃ¡c'],
                _gioiTinh,
                (v) => setState(() => _gioiTinh = v),
              ),
              _buildTextField(
                'Sá»‘ Ä‘iá»‡n thoáº¡i',
                controller: _soDienThoai,
                keyboardType: TextInputType.phone,
              ),
              _buildTextField('Äá»‹a chá»‰', controller: _diaChi),
              _buildTextField(
                'Sá»‘ tháº» BHYT (náº¿u cÃ³)',
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
                label: Text('Táº¡o há»“ sÆ¡ bá»‡nh nhÃ¢n'),
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

  // (Giá»¯ nguyÃªn 3 hÃ m helper: _buildTextField, _buildDropdown, _buildDateField)
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
                return '$label lÃ  báº¯t buá»™c';
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
            v == null || v.isEmpty ? 'Vui lÃ²ng chá»n $label' : null,
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
        validator: (v) => (v == null || v.isEmpty) && label == 'NgÃ y sinh'
            ? '$label lÃ  báº¯t buá»™c'
            : null, // Sá»­a: Chá»‰ validate náº¿u lÃ  'NgÃ y sinh'
      ),
    );
  }
}
