// lib/screens/doctor/thong_tin_ca_nhan_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'doctor_bottom_nav_bar.dart';

// Sá»¬A: Model cho Khoa
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

  // Sá»¬A: Controllers cho BÃ¡c sÄ© (theo model BacSi.js)
  final _hoTen = TextEditingController();
  final _chuyenMon = TextEditingController();
  final _chucVu = TextEditingController();
  final _trinhDo = TextEditingController();

  // State cho dropdown Khoa
  List<Khoa> _khoaList = [];
  String? _selectedKhoa;

  // ThÃ´ng tin tÃ i khoáº£n
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
      // Sá»¬A: Gá»i API song song
      final responses = await Future.wait([
        _api.get('/bacsi/tk/$_maTK'), // Sá»¬A: API Ä‘Ãºng
        _api.get('/khoa'), // API láº¥y danh sÃ¡ch khoa
      ]);

      if (responses[0].statusCode == 200 && responses[1].statusCode == 200) {
        final dataBS = jsonDecode(responses[0].body)['data'];
        final dataKhoa = jsonDecode(responses[1].body)['data'] as List;

        setState(() {
          // GÃ¡n danh sÃ¡ch khoa
          _khoaList = dataKhoa.map((j) => Khoa.fromJson(j)).toList();

          // GÃ¡n thÃ´ng tin BÃ¡c sÄ©
          _maBS = dataBS['maBS'];
          _hoTen.text = dataBS['hoTen'] ?? '';
          _chuyenMon.text = dataBS['chuyenMon'] ?? '';
          _chucVu.text = dataBS['chucVu'] ?? '';
          _trinhDo.text = dataBS['trinhDo'] ?? '';
          _selectedKhoa = dataBS['maKhoa']; // GÃ¡n khoa hiá»‡n táº¡i

          // GÃ¡n thÃ´ng tin tÃ i khoáº£n (tá»« backend Ä‘Ã£ join)
          _tenDangNhap = dataBS['TaiKhoan']?['tenDangNhap'] ?? '';
          _email = dataBS['TaiKhoan']?['email'] ?? '';

          _isLoading = false;
        });
      } else {
        _showError('Lá»—i táº£i dá»¯ liá»‡u tá»« mÃ¡y chá»§');
      }
    } catch (e) {
      _showError('Lá»—i táº£i thÃ´ng tin cÃ¡ nhÃ¢n: $e');
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
      _showError('Lá»—i: KhÃ´ng tÃ¬m tháº¥y mÃ£ bÃ¡c sÄ© Ä‘á»ƒ cáº­p nháº­t.');
      return;
    }

    // Sá»¬A: Gá»­i payload Ä‘Ãºng theo model BacSi.js
    final payload = {
      'hoTen': _hoTen.text,
      'chuyenMon': _chuyenMon.text,
      'chucVu': _chucVu.text,
      'trinhDo': _trinhDo.text,
      'maKhoa': _selectedKhoa,
    };

    try {
      // API cáº­p nháº­t BÃ¡c sÄ© /bacsi/:id
      final res = await _api.put('/bacsi/$_maBS', payload);
      if (!mounted) return;
      if (res.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âœ… Cáº­p nháº­t thÃ nh cÃ´ng!'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        _showError('Lá»—i: ${jsonDecode(res.body)['message']}');
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('ThÃ´ng tin cÃ¡ nhÃ¢n BÃ¡c sÄ©'),
        backgroundColor: Color(0xFF004D40), // MÃ u BÃ¡c sÄ©
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/doctor'), // Vá» trang chá»§ BS
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
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                children: [
                  // Card thÃ´ng tin tÃ i khoáº£n
                  Card(
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'ThÃ´ng tin Ä‘Äƒng nháº­p',
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
                            title: Text('TÃªn Ä‘Äƒng nháº­p: $_tenDangNhap'),
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
                  // Card thÃ´ng tin cÃ¡ nhÃ¢n
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
                              'ThÃ´ng tin chuyÃªn mÃ´n',
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.bold),
                            ),
                            SizedBox(height: 16),

                            // Sá»¬A: Thay tháº¿ báº±ng cÃ¡c trÆ°á»ng cá»§a BÃ¡c sÄ©
                            _buildTextField('Há» tÃªn', controller: _hoTen),

                            // Sá»¬A: Dropdown cho Khoa
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
                              'ChuyÃªn mÃ´n',
                              controller: _chuyenMon,
                            ),
                            _buildTextField('Chá»©c vá»¥', controller: _chucVu),
                            _buildTextField(
                              'TrÃ¬nh Ä‘á»™',
                              controller: _trinhDo,
                            ),

                            SizedBox(height: 20),
                            ElevatedButton.icon(
                              onPressed: _handleSubmit,
                              icon: Icon(Icons.save),
                              label: Text('Cáº­p nháº­t thÃ´ng tin'),
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
      // Sá»¬A: Cáº­p nháº­t currentIndex (giáº£ Ä‘á»‹nh lÃ  4)
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
          fillColor: readOnly
              ? Theme.of(context).disabledColor.withValues(alpha: 0.08)
              : Theme.of(context).colorScheme.surface,
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

  // Sá»¬A: Cáº­p nháº­t hÃ m Dropdown (linh hoáº¡t hÆ¡n)
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
            v == null || v.isEmpty ? 'Vui lÃ²ng chá»n $label' : null,
      ),
    );
  }
}
