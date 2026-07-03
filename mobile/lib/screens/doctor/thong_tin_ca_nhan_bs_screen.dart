// lib/screens/doctor/thong_tin_ca_nhan_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'doctor_bottom_nav_bar.dart';

// SỬA: Model cho Khoa
class Khoa {
  final String maKhoa;
  final String tenKhoa;
  Khoa({required this.maKhoa, required this.tenKhoa});
  factory Khoa.fromJson(Map<String, dynamic> json) =>
      Khoa(maKhoa: json['maKhoa'], tenKhoa: json['tenKhoa']);
}

class ThongTinCaNhanBSScreen extends StatefulWidget {
  const ThongTinCaNhanBSScreen({super.key});

  @override
  State<ThongTinCaNhanBSScreen> createState() => _ThongTinCaNhanBSScreenState();
}

class _ThongTinCaNhanBSScreenState extends State<ThongTinCaNhanBSScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  String? _maTK;
  String? _maBS;

  // SỬA: Controllers cho Bác sĩ (theo model BacSi.js)
  final _hoTen = TextEditingController();
  final _chuyenMon = TextEditingController();
  final _chucVu = TextEditingController();
  final _trinhDo = TextEditingController();

  // State cho dropdown Khoa
  List<Khoa> _khoaList = [];
  String? _selectedKhoa;

  // Thông tin tài khoản
  String _tenDangNhap = '';
  String _email = '';

  @override
  void initState() {
    super.initState();
    _maTK = Provider.of<AuthProvider>(context, listen: false).maTK;
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (_maTK == null) return;
    setState(() => _isLoading = true);
    try {
      // SỬA: Gọi API song song
      final responses = await Future.wait([
        _api.get('/bacsi/tk/$_maTK'), // SỬA: API đúng
        _api.get('/khoa'), // API lấy danh sách khoa
      ]);

      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        final dataBS = jsonDecode(responses[0].body)['data'];
        final dataKhoa = jsonDecode(responses[1].body)['data'] as List;

        setState(() {
          // Gán danh sách khoa
          _khoaList = dataKhoa.map((j) => Khoa.fromJson(j)).toList();

          // Gán thông tin Bác sĩ
          _maBS = dataBS['maBS'];
          _hoTen.text = dataBS['hoTen'] ?? '';
          _chuyenMon.text = dataBS['chuyenMon'] ?? '';
          _chucVu.text = dataBS['chucVu'] ?? '';
          _trinhDo.text = dataBS['trinhDo'] ?? '';
          _selectedKhoa = dataBS['maKhoa']; // Gán khoa hiện tại

          // Gán thông tin tài khoản (từ backend đã join)
          _tenDangNhap = dataBS['TaiKhoan']?['tenDangNhap'] ?? '';
          _email = dataBS['TaiKhoan']?['email'] ?? '';

          _isLoading = false;
        });
      } else {
        _showError('Lỗi tải dữ liệu từ máy chủ');
      }
    } catch (e) {
      _showError('Lỗi tải thông tin cá nhân: $e');
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_maBS == null) {
      _showError('Lỗi: Không tìm thấy mã bác sĩ để cập nhật.');
      return;
    }

    // SỬA: Gửi payload đúng theo model BacSi.js
    final payload = {
      'hoTen': _hoTen.text,
      'chuyenMon': _chuyenMon.text,
      'chucVu': _chucVu.text,
      'trinhDo': _trinhDo.text,
      'maKhoa': _selectedKhoa,
    };

    try {
      // API cập nhật Bác sĩ /bacsi/:id
      final res = await _api.put('/bacsi/$_maBS', payload);
      if (!mounted) return;
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Cập nhật thành công!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        _showError('Lỗi: ${jsonDecode(res.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Thông tin cá nhân Bác sĩ'),
        backgroundColor: Color(0xFF004D40), // Màu Bác sĩ
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/doctor'), // Về trang chủ BS
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
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  // Card thông tin tài khoản
                  Card(
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Thông tin đăng nhập',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          SizedBox(height: 12),
                          ListTile(
                            leading: FaIcon(
                              FontAwesomeIcons.userLock,
                              size: 20,
                              color: Colors.grey[700],
                            ),
                            title: Text('Tên đăng nhập: $_tenDangNhap'),
                          ),
                          ListTile(
                            leading: FaIcon(
                              FontAwesomeIcons.solidEnvelope,
                              size: 20,
                              color: Colors.grey[700],
                            ),
                            title: Text('Email: $_email'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(height: 20),
                  // Card thông tin cá nhân
                  Card(
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              'Thông tin chuyên môn',
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            SizedBox(height: 16),

                            // SỬA: Thay thế bằng các trường của Bác sĩ
                            _buildTextField('Họ tên', controller: _hoTen),

                            // SỬA: Dropdown cho Khoa
                            _buildDropdown(
                              'Khoa',
                              _khoaList.map((k) => k.tenKhoa).toList(),
                              _khoaList
                                  .firstWhere(
                                    (k) => k.maKhoa == _selectedKhoa,
                                    orElse: () => _khoaList.first,
                                  )
                                  .tenKhoa,
                              (tenKhoa) {
                                setState(() {
                                  _selectedKhoa = _khoaList
                                      .firstWhere((k) => k.tenKhoa == tenKhoa)
                                      .maKhoa;
                                });
                              },
                              itemsList: _khoaList
                                  .map(
                                    (k) => DropdownMenuItem<String>(
                                      value: k.tenKhoa,
                                      child: Text(k.tenKhoa),
                                    ),
                                  )
                                  .toList(),
                            ),

                            _buildTextField(
                              'Chuyên môn',
                              controller: _chuyenMon,
                            ),
                            _buildTextField('Chức vụ', controller: _chucVu),
                            _buildTextField('Trình độ', controller: _trinhDo),

                            SizedBox(height: 20),
                            ElevatedButton.icon(
                              onPressed: _handleSubmit,
                              icon: Icon(Icons.save),
                              label: Text('Cập nhật thông tin'),
                              style: ElevatedButton.styleFrom(
                                minimumSize: Size(double.infinity, 44),
                                backgroundColor: Colors.teal[700],
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
      // SỬA: Cập nhật currentIndex (giả định là 4)
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 4),
    );
  }

  // (Helper _buildTextField)
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
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          filled: readOnly,
          fillColor: readOnly ? Colors.grey[100] : Colors.white,
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

  // SỬA: Cập nhật hàm Dropdown (linh hoạt hơn)
  Widget _buildDropdown(
    String label,
    List<String> items,
    String? currentValue,
    Function(String?) onChanged, {
    List<DropdownMenuItem<String>>? itemsList,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: DropdownButtonFormField<String>(
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        ),
        initialValue: currentValue,
        items:
            itemsList ??
            items
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
}
