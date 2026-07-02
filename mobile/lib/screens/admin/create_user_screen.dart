// lib/screens/admin/create_user_screen.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../models/user_model.dart';
import '../../services/api_client.dart';

// --- Cáº¥u hÃ¬nh ---
const List<String> roles = ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN'];
const List<String> staffTypes = ['YT', 'XN', 'TN'];

// Lá»›p Khoa Ä‘Æ¡n giáº£n
class Khoa {
  final String maKhoa;
  final String tenKhoa;
  Khoa({required this.maKhoa, required this.tenKhoa});

  factory Khoa.fromJson(Map<String, dynamic> json) {
    return Khoa(maKhoa: json['maKhoa'], tenKhoa: json['tenKhoa']);
  }
}

// ===============================================
//           MÃ€N HÃŒNH Táº O/Sá»¬A TÃ€I KHOáº¢N
// ===============================================
class CreateUserScreen extends StatefulWidget {
  final dynamic userToEdit; // Nháº­n 'dynamic' tá»« GoRouter

  const CreateUserScreen({super.key, this.userToEdit});

  @override
  State<CreateUserScreen> createState() => _CreateUserScreenState();
}

class _CreateUserScreenState extends State<CreateUserScreen> {
  final _formKey = GlobalKey<FormState>();
  late String _title;
  late bool _isEditMode;
  bool _isLoading = false;
  final ApiClient _api = ApiClient();

  // (Giá»¯ nguyÃªn toÃ n bá»™ pháº§n state, controllers, vÃ  logic initState, dispose, _fetchKhoas, _handleSubmit)
  List<Khoa> _khoasList = [];
  bool _isLoadingKhoas = true;

  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _emailController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _specialtyController = TextEditingController();
  final _degreeController = TextEditingController();
  final _positionController = TextEditingController();
  final _rankController = TextEditingController();
  final _addressController = TextEditingController();
  final _phoneController = TextEditingController();
  final _bhytController = TextEditingController();

  String _vaiTro = '';
  String? _maKhoa;
  String? _loaiNS;
  String? _gioiTinh;
  DateTime? _ngaySinh;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.userToEdit != null;
    _title = _isEditMode
        ? 'âœï¸ Cáº­p nháº­t tÃ i khoáº£n'
        : 'âž• Táº¡o tÃ i khoáº£n má»›i';

    _fetchKhoas();

    if (_isEditMode) {
      final UserModel user = widget.userToEdit as UserModel;

      _usernameController.text = user.tenDangNhap;
      _emailController.text = user.email ?? '';
      _vaiTro = user.maNhom;
      _fullNameController.text = user.hoTen ?? '';
      _maKhoa = user.maKhoa;
      _specialtyController.text = user.chuyenMon ?? '';

      _degreeController.text = user.trinhDo ?? '';
      _positionController.text = user.chucVu ?? '';

      _loaiNS = user.loaiNS;
      _rankController.text = user.capBac ?? '';

      _addressController.text = user.diaChi ?? '';
      _phoneController.text = user.soDienThoai ?? '';
      _bhytController.text = user.bhyt ?? '';
      _gioiTinh = user.gioiTinh;
      if (user.ngaySinh != null && user.ngaySinh!.isNotEmpty) {
        try {
          _ngaySinh = DateFormat(
            'yyyy-MM-dd',
          ).parse(user.ngaySinh!.split('T').first);
        } catch (e) {
          print('Lá»—i parse ngÃ y sinh: $e');
        }
      }
    }
  }

  Future<void> _fetchKhoas() async {
    try {
      final response = await _api.get('/khoa');
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final List<dynamic> data = body['data'];
        setState(() {
          _khoasList = data.map((json) => Khoa.fromJson(json)).toList();
          _isLoadingKhoas = false;
        });
      } else {
        setState(() => _isLoadingKhoas = false);
      }
    } catch (e) {
      setState(() => _isLoadingKhoas = false);
    }
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _emailController.dispose();
    _fullNameController.dispose();
    _specialtyController.dispose();
    _degreeController.dispose();
    _positionController.dispose();
    _rankController.dispose();
    _addressController.dispose();
    _phoneController.dispose();
    _bhytController.dispose();
    super.dispose();
  }

  void _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    Map<String, dynamic> payload = {
      'tenDangNhap': _usernameController.text,
      'email': _emailController.text.isEmpty ? null : _emailController.text,
      'maNhom': _vaiTro,
    };

    if (!_isEditMode || (_isEditMode && _passwordController.text.isNotEmpty)) {
      payload['matKhau'] = _passwordController.text;
    }

    if (_vaiTro == 'BACSI' || _vaiTro == 'NHANSU') {
      payload['maKhoa'] = _maKhoa;
      payload['hoTen'] = _fullNameController.text;
      payload['chuyenMon'] = _specialtyController.text;
    }

    if (_vaiTro == 'NHANSU') {
      payload['loaiNS'] = _loaiNS;
      payload['capBac'] = _rankController.text;
    }

    if (_vaiTro == 'BACSI') {
      payload['trinhDo'] = _degreeController.text;
      payload['chucVu'] = _positionController.text;
    }

    if (_vaiTro == 'BENHNHAN') {
      payload['hoTen'] = _fullNameController.text;
      payload['ngaySinh'] = _ngaySinh?.toIso8601String().split('T').first;
      payload['gioiTinh'] = _gioiTinh;
      payload['diaChi'] = _addressController.text;
      payload['soDienThoai'] = _phoneController.text;
      payload['bhyt'] = _bhytController.text.isEmpty
          ? null
          : _bhytController.text;
    }

    try {
      dynamic response;
      if (_isEditMode) {
        final maTK = (widget.userToEdit as UserModel).maTK;
        response = await _api.put('/tai-khoan/$maTK', payload);
      } else {
        response = await _api.post('/tai-khoan', payload);
      }

      if (!mounted) return;

      if (response.statusCode == 200 || response.statusCode == 201) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âœ… Thao tÃ¡c thÃ nh cÃ´ng!'),
            backgroundColor: Colors.green,
          ),
        );
        context.go('/admin/account/list'); // Quay vá» danh sÃ¡ch
      } else {
        final errorBody = jsonDecode(response.body);
        String errorMessage =
            errorBody['message'] ?? 'Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh';
        if (errorBody['errors'] != null && errorBody['errors'].isNotEmpty) {
          errorMessage = errorBody['errors'][0]['msg'] ?? errorMessage;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âŒ Lá»—i: $errorMessage'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('âŒ Lá»—i káº¿t ná»‘i: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _isEditMode ? 'Cáº­p nháº­t tÃ i khoáº£n' : 'Táº¡o tÃ i khoáº£n',
        ),
        backgroundColor: Theme.of(
          context,
        ).colorScheme.primary, // Thá»‘ng nháº¥t mÃ u
        // THÃŠM NÃšT HOME VÃ€ ÄÄ‚NG XUáº¤T
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/admin'),
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
        padding: const EdgeInsets.all(16.0),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(24.0),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
            ),
            constraints: BoxConstraints(maxWidth: 600),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.blue[700],
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 20),

                  // (Giá»¯ nguyÃªn code cÃ¡c trÆ°á»ng TextFields vÃ  Dropdowns...)
                  _buildTextField(
                    'TÃªn Ä‘Äƒng nháº­p',
                    controller: _usernameController,
                    readOnly: _isEditMode,
                  ),
                  _buildTextField(
                    'Máº­t kháº©u',
                    controller: _passwordController,
                    isPassword: true,
                    hint: _isEditMode
                        ? 'Äá»ƒ trá»‘ng náº¿u khÃ´ng Ä‘á»•i'
                        : null,
                    isRequired: !_isEditMode,
                    validator: (v) {
                      if (!_isEditMode && (v == null || v.isEmpty)) {
                        return 'Máº­t kháº©u lÃ  báº¯t buá»™c';
                      }
                      if (v != null && v.isNotEmpty && v.length < 6) {
                        return 'Máº­t kháº©u tá»‘i thiá»ƒu 6 kÃ½ tá»±';
                      }
                      return null;
                    },
                  ),
                  _buildTextField(
                    'Email',
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    isRequired: false,
                  ),

                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Vai trÃ²',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: _vaiTro.isEmpty ? null : _vaiTro,
                    items: roles
                        .map(
                          (role) => DropdownMenuItem<String>(
                            value: role,
                            child: Text(role),
                          ),
                        )
                        .toList(),
                    onChanged: (String? newValue) {
                      setState(() {
                        _vaiTro = newValue!;
                      });
                    },
                    validator: (v) => v == null || v.isEmpty
                        ? 'Vui lÃ²ng chá»n vai trÃ²'
                        : null,
                  ),
                  SizedBox(height: 16),

                  if (_vaiTro == 'BACSI' || _vaiTro == 'NHANSU') ...[
                    _buildTextField(
                      'Há» tÃªn',
                      controller: _fullNameController,
                    ),
                    _buildKhoaDropdown(),
                  ],

                  if (_vaiTro == 'NHANSU') ...[
                    _buildDropdown(
                      'Loáº¡i NhÃ¢n sá»±',
                      staffTypes,
                      _loaiNS,
                      (v) => setState(() => _loaiNS = v),
                    ),
                    _buildTextField(
                      'Cáº¥p báº­c',
                      hint: 'Äiá»u dÆ°á»¡ng, Ká»¹ thuáº­t viÃªn...',
                      controller: _rankController,
                    ),
                    _buildTextField(
                      'ChuyÃªn mÃ´n',
                      hint: 'XÃ©t nghiá»‡m, Tiáº¿p nháº­n...',
                      controller: _specialtyController,
                    ),
                  ],

                  if (_vaiTro == 'BACSI') ...[
                    _buildTextField(
                      'ChuyÃªn mÃ´n',
                      hint: 'Ná»™i Tim máº¡ch, Ngoáº¡i Tháº§n kinh...',
                      controller: _specialtyController,
                    ),
                    _buildTextField(
                      'TrÃ¬nh Ä‘á»™',
                      hint: 'Tháº¡c sÄ©, Tiáº¿n sÄ©...',
                      controller: _degreeController,
                    ),
                    _buildTextField(
                      'Chá»©c vá»¥',
                      hint: 'TrÆ°á»Ÿng khoa, PhÃ³ khoa...',
                      controller: _positionController,
                    ),
                  ],

                  if (_vaiTro == 'BENHNHAN') ...[
                    _buildTextField(
                      'Há» tÃªn',
                      controller: _fullNameController,
                    ),
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
                      'Äá»‹a chá»‰',
                      controller: _addressController,
                    ),
                    _buildTextField(
                      'Sá»‘ Ä‘iá»‡n thoáº¡i',
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                    ),
                    _buildTextField(
                      'Sá»‘ tháº» BHYT (náº¿u cÃ³)',
                      controller: _bhytController,
                      isRequired: false,
                    ),
                  ],

                  SizedBox(height: 30),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isLoading ? null : _handleSubmit,
                      icon: _isLoading
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 3,
                              ),
                            )
                          : FaIcon(
                              _isEditMode
                                  ? FontAwesomeIcons.solidFloppyDisk
                                  : FontAwesomeIcons.plus,
                              size: 18,
                            ), // Sá»­a: DÃ¹ng solidFloppyDisk
                      label: Text(
                        _isEditMode
                            ? 'LÆ°u cáº­p nháº­t'
                            : 'Táº¡o tÃ i khoáº£n',
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _isLoading
                            ? Colors.grey
                            : Colors.green,
                        padding: EdgeInsets.symmetric(vertical: 16),
                        textStyle: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  // (Giá»¯ nguyÃªn 4 hÃ m helper: _buildKhoaDropdown, _buildTextField, _buildDropdown, _buildDateField)
  // ...
  Widget _buildKhoaDropdown() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: DropdownButtonFormField<String>(
        decoration: InputDecoration(
          labelText: 'Khoa',
          border: OutlineInputBorder(),
          suffixIcon: _isLoadingKhoas
              ? Padding(
                  padding: const EdgeInsets.all(10.0),
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : null,
        ),
        initialValue: _maKhoa,
        items: _isLoadingKhoas
            ? [
                DropdownMenuItem<String>(
                  value: null,
                  child: Text('Äang táº£i khoa...'),
                ),
              ]
            : _khoasList
                  .map(
                    (khoa) => DropdownMenuItem<String>(
                      value: khoa.maKhoa,
                      child: Text(khoa.tenKhoa),
                    ),
                  )
                  .toList(),
        onChanged: (String? newValue) {
          setState(() {
            _maKhoa = newValue;
          });
        },
        validator: (v) =>
            v == null || v.isEmpty ? 'Vui lÃ²ng chá»n khoa' : null,
      ),
    );
  }

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
        items: items.map((itemText) {
          final value = itemText.split(' ').first;
          return DropdownMenuItem<String>(value: value, child: Text(itemText));
        }).toList(),
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
          if (picked != null) {
            onChanged(picked); // Cáº­p nháº­t state
          }
        },
        validator: (v) =>
            v == null || v.isEmpty ? '$label lÃ  báº¯t buá»™c' : null,
      ),
    );
  }
}
