// lib/screens/nhansu/phieu_xet_nghiem_ns_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
// Import cho upload
import 'package:image_picker/image_picker.dart';

// --- MODELS ---
class YeuCauSimple {
  final String maYeuCau;
  final String maBN;
  YeuCauSimple({required this.maYeuCau, required this.maBN});
  factory YeuCauSimple.fromJson(Map<String, dynamic> json) =>
      YeuCauSimple(maYeuCau: json['maYeuCau'], maBN: json['maBN']);
}

class XetNghiemSimple {
  final String maXN;
  final String tenXN;
  XetNghiemSimple({required this.maXN, required this.tenXN});
  factory XetNghiemSimple.fromJson(Map<String, dynamic> json) =>
      XetNghiemSimple(maXN: json['maXN'], tenXN: json['tenXN']);
}

class HSBASimple {
  final String maHSBA;
  final String maBN;
  HSBASimple({required this.maHSBA, required this.maBN});
  factory HSBASimple.fromJson(Map<String, dynamic> json) =>
      HSBASimple(maHSBA: json['maHSBA'], maBN: json['maBN']);
}

class PhieuXNModel {
  final String maPhieuXN;
  final String maYeuCau;
  final String? tenXN;
  final String maHSBA;
  final String ngay;
  final String? ketQua;
  final String? ghiChu;
  final String? tenNguoiNhap;

  PhieuXNModel({
    required this.maPhieuXN,
    required this.maYeuCau,
    this.tenXN,
    required this.maHSBA,
    required this.ngay,
    this.ketQua,
    this.ghiChu,
    this.tenNguoiNhap,
  });

  factory PhieuXNModel.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayThucHien'] ?? '';
    try {
      fNgay = DateFormat(
        'yyyy-MM-dd',
      ).format(DateTime.parse(json['ngayThucHien']).toLocal());
    } catch (_) {}

    return PhieuXNModel(
      maPhieuXN: json['maPhieuXN'],
      maYeuCau: json['maYeuCau'],
      tenXN: json['XetNghiem']?['tenXN'] ?? 'N/A',
      maHSBA: json['maHSBA'] ?? 'N/A',
      ngay: fNgay,
      ketQua: json['ketQua'],
      ghiChu: json['ghiChu'],
      tenNguoiNhap: json['NhanSuYTe']?['hoTen'] ?? 'N/A',
    );
  }
}
// --- END MODELS ---

class PhieuXetNghiemNSScreen extends StatefulWidget {
  const PhieuXetNghiemNSScreen({super.key});

  @override
  State<PhieuXetNghiemNSScreen> createState() => _PhieuXetNghiemNSScreenState();
}

class _PhieuXetNghiemNSScreenState extends State<PhieuXetNghiemNSScreen> {
  final ApiClient _api = ApiClient();
  final _formKey = GlobalKey<FormState>();
  final _ketQuaController = TextEditingController();
  final _ghiChuController = TextEditingController();

  List<PhieuXNModel> _list = [];
  List<YeuCauSimple> _dsYeuCau = [];
  List<XetNghiemSimple> _dsXN = [];
  List<HSBASimple> _dsHSBA = [];
  bool _isLoading = true;

  // Form State
  String? _selectedYeuCau;
  String? _selectedXN;
  String? _selectedHSBA;
  DateTime _selectedDate = DateTime.now();

  // State vÃ  controller cho chá»©c nÄƒng upload
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  // Káº¿t thÃºc pháº§n upload

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    try {
      final responses = await Future.wait([
        _api.get('/phieuxetnghiem'), // Danh sÃ¡ch phiáº¿u Ä‘Ã£ cÃ³
        _api.get('/yeucauxetnghiem'), // Danh sÃ¡ch yÃªu cáº§u
        _api.get('/xetnghiem'), // Danh sÃ¡ch xÃ©t nghiá»‡m
        _api.get('/hsba'), // List HSBA
      ]);

      setState(() {
        _list = (jsonDecode(responses[0].body)['data'] as List)
            .map((j) => PhieuXNModel.fromJson(j))
            .toList();
        _dsYeuCau = (jsonDecode(responses[1].body)['data'] as List)
            .map((j) => YeuCauSimple.fromJson(j))
            .toList();
        _dsXN = (jsonDecode(responses[2].body)['data'] as List)
            .map((j) => XetNghiemSimple.fromJson(j))
            .toList();
        _dsHSBA = (jsonDecode(responses[3].body)['data'] as List)
            .map((j) => HSBASimple.fromJson(j))
            .toList();
      });
    } catch (e) {
      _showError('L?i t?i d? li?u: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  // HÃ m chá»n áº£nh
  Future<void> _pickImage() async {
    final XFile? pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
    );
    if (pickedFile != null) {
      setState(() {
        _selectedImage = pickedFile;
      });
    }
  }
  // Káº¿t thÃºc pháº§n upload

  // HÃ m táº¡o phiáº¿u xÃ©t nghiá»‡m hoÃ n chá»‰nh
  Future<void> _handleCreatePhieuHoanChinh() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedYeuCau == null ||
        _selectedXN == null ||
        _selectedHSBA == null) {
      _showError(
        "Vui lÃ²ng chá»n Ä‘á»§ yÃªu cáº§u, xÃ©t nghiá»‡m vÃ  há»“ sÆ¡ bá»‡nh Ã¡n.",
      );
      return;
    }

    final payload = {
      'maYeuCau': _selectedYeuCau,
      'maXN': _selectedXN,
      'maHSBA': _selectedHSBA,
      'ngayThucHien': DateFormat('yyyy-MM-dd').format(_selectedDate),
      'ghiChu': _ghiChuController.text,
      'ketQua': _ketQuaController.text,
    };

    setState(() => _isLoading = true);
    final endpoint = '/phieuxetnghiem'; // Endpoint chÃ­nh

    try {
      dynamic response;
      if (_selectedImage != null) {
        // Gá»­i multipart
        final Map<String, String> fields = payload.map(
          (k, v) => MapEntry(k, v?.toString() ?? ''),
        );

        response = await _api.postMultipart(
          endpoint,
          fields,
          file: _selectedImage,
          fileFieldName: 'file', // TrÆ°á»ng file upload
        );
      } else {
        // Gá»­i JSON
        response = await _api.post(endpoint, payload);
      }

      if (response.statusCode == 201) {
        _showSuccess('ÄÃ£ lÆ°u phiáº¿u xÃ©t nghiá»‡m thÃ nh cÃ´ng!');
        _loadAllData();
        _formKey.currentState?.reset();
        _ketQuaController.clear();
        _ghiChuController.clear();
        setState(() {
          _selectedYeuCau = null;
          _selectedXN = null;
          _selectedHSBA = null;
          _selectedDate = DateTime.now();
          _selectedImage = null; // Reset ?nh
        });
      } else {
        String errorMessage = 'L?i luu phi?u: ${response.statusCode}';
        try {
          final errorBody = jsonDecode(response.body);
          errorMessage = errorBody['message'] ?? errorMessage;
        } catch (_) {}
        _showError(errorMessage);
      }
    } catch (e) {
      _showError('L?i k?t n?i: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Phiáº¿u xÃ©t nghiá»‡m (NhÃ¢n sá»±)'),
        backgroundColor: Colors.indigo[700], // MÃ u xÃ©t nghiá»‡m
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang ch?',
            onPressed: () => context.go('/xetnghiem'),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // --- FORM GHI PHIáº¾U HOÃ€N CHá»ˆNH ---
                  Text(
                    'Phiáº¿u xÃ©t nghiá»‡m (NhÃ¢n viÃªn xÃ©t nghiá»‡m)',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 16),
                  Card(
                    elevation: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Form(
                        key: _formKey,
                        child: Column(
                          children: [
                            // HÃ ng 1: lá»±a chá»n vÃ  ngÃ y thá»±c hiá»‡n
                            Row(
                              children: [
                                Expanded(
                                  child: _buildDropdown(
                                    'Chá»n yÃªu cáº§u',
                                    _dsYeuCau
                                        .map(
                                          (e) => DropdownMenuItem<String>(
                                            value: e.maYeuCau,
                                            child: Text(e.maYeuCau),
                                          ),
                                        )
                                        .toList(),
                                    (v) => setState(() => _selectedYeuCau = v),
                                    _selectedYeuCau,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Expanded(
                                  child: _buildDropdown(
                                    'Chá»n xÃ©t nghiá»‡m',
                                    _dsXN
                                        .map(
                                          (e) => DropdownMenuItem<String>(
                                            value: e.maXN,
                                            child: Text(e.tenXN),
                                          ),
                                        )
                                        .toList(),
                                    (v) => setState(() => _selectedXN = v),
                                    _selectedXN,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 12),
                            Row(
                              children: [
                                Expanded(
                                  child: _buildDropdown(
                                    'Ch?n HSBA',
                                    _dsHSBA
                                        .map(
                                          (e) => DropdownMenuItem<String>(
                                            value: e.maHSBA,
                                            child: Text(e.maHSBA),
                                          ),
                                        )
                                        .toList(),
                                    (v) => setState(() => _selectedHSBA = v),
                                    _selectedHSBA,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Expanded(child: _buildDateField(context)),
                              ],
                            ),
                            SizedBox(height: 16),

                            // HÃ ng 2: káº¿t quáº£
                            TextFormField(
                              controller: _ketQuaController,
                              decoration: InputDecoration(
                                labelText: 'Káº¿t quáº£ xÃ©t nghiá»‡m',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 3,
                              validator: (v) => v!.isEmpty
                                  ? 'Vui lÃ²ng nháº­p káº¿t quáº£'
                                  : null,
                            ),
                            SizedBox(height: 12),

                            // HÃ ng 3: ghi chÃº
                            TextFormField(
                              controller: _ghiChuController,
                              decoration: InputDecoration(
                                labelText: 'Ghi chÃº',
                                border: OutlineInputBorder(),
                              ),
                              maxLines: 2,
                            ),

                            // VÃ¹ng chá»n áº£nh
                            SizedBox(height: 16),
                            Text(
                              'HÃ¬nh áº£nh káº¿t quáº£ xÃ©t nghiá»‡m (tÃ¹y chá»n):',
                              style: TextStyle(fontWeight: FontWeight.w500),
                            ),
                            SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton.icon(
                                    onPressed: _pickImage,
                                    icon: Icon(Icons.photo_library),
                                    label: Text(
                                      _selectedImage == null
                                          ? 'Ch?n ?nh'
                                          : 'Äá»•i áº£nh',
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.grey[200],
                                      foregroundColor: Colors.black87,
                                    ),
                                  ),
                                ),
                                if (_selectedImage != null) ...[
                                  SizedBox(width: 10),
                                  Expanded(
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Flexible(
                                          child: Text(
                                            'ÄÃ£ chá»n: ${_selectedImage!.name}',
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        IconButton(
                                          icon: Icon(
                                            Icons.close,
                                            color: Colors.red,
                                          ),
                                          onPressed: () => setState(
                                            () => _selectedImage = null,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ],
                            ),

                            // Káº¿t thÃºc pháº§n upload
                            SizedBox(height: 20),

                            // NÃºt thao tÃ¡c Luu
                            ElevatedButton.icon(
                              onPressed: _handleCreatePhieuHoanChinh,
                              icon: Icon(Icons.save),
                              label: Text('LÆ°u phiáº¿u xÃ©t nghiá»‡m'),
                              style: ElevatedButton.styleFrom(
                                minimumSize: Size(double.infinity, 48),
                                backgroundColor: Colors.blue[800],
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: 30),

                  // --- DANH SÃCH PHIáº¾U ÄÃƒ CÃ“ ---
                  Text(
                    'Lá»‹ch sá»­ phiáº¿u xÃ©t nghiá»‡m',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 12),
                  _buildListPhieu(),
                ],
              ),
            ),
    );
  }
  // CÃ¡c hÃ m há»— trá»£

  Widget _buildDropdown(
    String label,
    List<DropdownMenuItem<String>> items,
    Function(String?) onChanged,
    String? currentValue,
  ) {
    return DropdownButtonFormField<String>(
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(),
      ),
      initialValue: currentValue,
      items: items,
      onChanged: onChanged,
      validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
    );
  }

  Widget _buildDateField(BuildContext context) {
    return TextFormField(
      readOnly: true,
      controller: TextEditingController(
        text: DateFormat('dd/MM/yyyy').format(_selectedDate),
      ),
      decoration: InputDecoration(
        labelText: 'NgÃ y thá»±c hiá»‡n',
        border: OutlineInputBorder(),
        suffixIcon: Icon(Icons.calendar_today),
      ),
      onTap: () async {
        DateTime? picked = await showDatePicker(
          context: context,
          initialDate: _selectedDate,
          firstDate: DateTime(2020),
          lastDate: DateTime.now(),
        );
        if (picked != null) setState(() => _selectedDate = picked);
      },
      validator: (v) => v!.isEmpty ? 'B?t bu?c' : null,
    );
  }

  Widget _buildListPhieu() {
    if (_list.isEmpty) {
      return Center(child: Text('KhÃ´ng cÃ³ phiáº¿u xÃ©t nghiá»‡m nÃ o.'));
    }

    // DÃ¹ng DataTable Ä‘á»ƒ hiá»ƒn thá»‹ dá»¯ liá»‡u cÃ³ cáº¥u trÃºc
    return Card(
      elevation: 2,
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 18,
          dataRowMinHeight: 50,
          dataRowMaxHeight: 50,
          headingRowColor: WidgetStateProperty.all(Colors.indigo[50]),
          columns: [
            DataColumn(label: Text('MÃ£')),
            DataColumn(label: Text('YC')),
            DataColumn(label: Text('XÃ©t nghiá»‡m')),
            DataColumn(label: Text('HSBA')),
            DataColumn(label: Text('NgÃ y')),
            DataColumn(label: Text('K?t qu?')),
            DataColumn(label: Text('Ngu?i nh?p')),
            DataColumn(label: Text('XÃ³a')),
          ],
          rows: _list
              .map(
                (phieu) => DataRow(
                  cells: [
                    DataCell(Text(phieu.maPhieuXN.substring(0, 7))),
                    DataCell(Text(phieu.maYeuCau.substring(0, 7))),
                    DataCell(Text(phieu.tenXN ?? '-')),
                    DataCell(Text(phieu.maHSBA)),
                    DataCell(Text(phieu.ngay)),
                    DataCell(Text(phieu.ketQua ?? '-')),
                    DataCell(Text(phieu.tenNguoiNhap ?? '-')),
                    DataCell(
                      IconButton(
                        icon: Icon(Icons.delete_outline, color: Colors.red),
                        onPressed: () {
                          // KhÃ´ng thá»ƒ xÃ³a phiáº¿u Ä‘Ã£ ghi nháº­n
                        },
                      ),
                    ),
                  ],
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}
