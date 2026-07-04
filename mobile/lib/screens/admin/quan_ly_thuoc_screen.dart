// lib/screens/admin/quan_ly_thuoc_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';
import 'package:intl/intl.dart';

// Models
class NhomThuoc {
  final String maNhom;
  final String tenNhom;
  NhomThuoc({required this.maNhom, required this.tenNhom});
  factory NhomThuoc.fromJson(Map<String, dynamic> json) =>
      NhomThuoc(maNhom: json['maNhom'], tenNhom: json['tenNhom']);
}

class DonViTinh {
  final String maDVT;
  final String tenDVT;
  DonViTinh({required this.maDVT, required this.tenDVT});
  factory DonViTinh.fromJson(Map<String, dynamic> json) =>
      DonViTinh(maDVT: json['maDVT'], tenDVT: json['tenDVT']);
}

class Thuoc {
  final String maThuoc;
  final String tenThuoc;
  final String? tenNhom;
  final String? tenDVT;
  final int tonKho;

  Thuoc({
    required this.maThuoc,
    required this.tenThuoc,
    this.tenNhom,
    this.tenDVT,
    required this.tonKho,
  });

  factory Thuoc.fromJson(Map<String, dynamic> json) {
    return Thuoc(
      maThuoc: json['maThuoc'],
      tenThuoc: json['tenThuoc'],
      tenNhom: json['NhomThuoc']?['tenNhom'] ?? 'N/A',
      tenDVT: json['DonViTinh']?['tenDVT'] ?? 'N/A',
      tonKho: json['tonKhoHienTai'] ?? 0,
    );
  }
}

class QuanLyThuocScreen extends StatefulWidget {
  const QuanLyThuocScreen({super.key});

  @override
  State<QuanLyThuocScreen> createState() => _QuanLyThuocScreenState();
}

class _QuanLyThuocScreenState extends State<QuanLyThuocScreen> {
  final ApiClient _api = ApiClient();
  List<Thuoc> _list = [];
  List<NhomThuoc> _nhomList = [];
  List<DonViTinh> _dvtList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final resThuoc = await _api.get('/thuoc');
      final resNhom = await _api.get('/thuoc/nhomthuoc');
      final resDVT = await _api.get('/thuoc/donvitinh');

      if (resThuoc.statusCode == 200 &&
          resNhom.statusCode == 200 &&
          resDVT.statusCode == 200) {
        final dataThuoc = jsonDecode(resThuoc.body)['data'] as List;
        final dataNhom = jsonDecode(resNhom.body)['data'] as List;
        final dataDVT = jsonDecode(resDVT.body)['data'] as List;

        setState(() {
          _list = dataThuoc.map((json) => Thuoc.fromJson(json)).toList();
          _nhomList = dataNhom.map((json) => NhomThuoc.fromJson(json)).toList();
          _dvtList = dataDVT.map((json) => DonViTinh.fromJson(json)).toList();
        });
      }
    } catch (e) {
      _showError('Lỗi tải dữ liệu: $e');
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

  Future<void> _handleDelete(String maThuoc) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá $maThuoc?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/thuoc/$maThuoc');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  // Dialog Thêm/Sửa (Phiên bản rút gọn, có thể thêm trường nếu cần)
  Future<void> _showAddEditDialog({Thuoc? thuoc}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = thuoc != null;

    // (Đây là phiên bản rút gọn, backend /thuoc/controller.js cần nhiều trường hơn)
    final tenController = TextEditingController(
      text: isEdit ? thuoc.tenThuoc : '',
    );
    String? selectedNhom = isEdit
        ? _nhomList
              .firstWhere(
                (n) => n.tenNhom == thuoc.tenNhom,
                orElse: () => _nhomList.first,
              )
              .maNhom
        : null;
    String? selectedDVT = isEdit
        ? _dvtList
              .firstWhere(
                (d) => d.tenDVT == thuoc.tenDVT,
                orElse: () => _dvtList.first,
              )
              .maDVT
        : null;
    final hoatChatController = TextEditingController(
      text: isEdit ? '' : '',
    ); // Cần thêm logic lấy chi tiết
    final giaBanController = TextEditingController(text: isEdit ? '' : '');
    final tonKhoController = TextEditingController(
      text: isEdit ? thuoc.tonKho.toString() : '0',
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sửa Thuốc' : 'Thêm Thuốc'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: tenController,
                    decoration: InputDecoration(labelText: 'Tên thuốc'),
                    validator: (v) => v!.isEmpty ? 'Không bỏ trống' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: hoatChatController,
                    decoration: InputDecoration(labelText: 'Hoạt chất'),
                    validator: (v) => v!.isEmpty ? 'Không bỏ trống' : null,
                  ),
                  SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Nhóm thuốc',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedNhom,
                    items: _nhomList
                        .map(
                          (nhom) => DropdownMenuItem<String>(
                            value: nhom.maNhom,
                            child: Text(nhom.tenNhom),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedNhom = v,
                    validator: (v) => v == null ? 'Vui lòng chọn' : null,
                  ),
                  SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Đơn vị tính',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedDVT,
                    items: _dvtList
                        .map(
                          (dvt) => DropdownMenuItem<String>(
                            value: dvt.maDVT,
                            child: Text(dvt.tenDVT),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedDVT = v,
                    validator: (v) => v == null ? 'Vui lòng chọn' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: giaBanController,
                    decoration: InputDecoration(labelText: 'Giá bán lẻ'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Không bỏ trống' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: tonKhoController,
                    decoration: InputDecoration(labelText: 'Tồn kho'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'Không bỏ trống' : null,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('Huỷ'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;

                // Backend yêu cầu rất nhiều trường, đây là các trường tối thiểu
                final payload = {
                  'tenThuoc': tenController.text,
                  'tenHoatChat': hoatChatController.text,
                  'maNhom': selectedNhom,
                  'maDVT': selectedDVT,
                  'giaBanLe': giaBanController.text,
                  'giaNhap': giaBanController.text, // Tạm
                  'tonKhoHienTai': tonKhoController.text,
                  'hanSuDung': DateFormat(
                    'yyyy-MM-dd',
                  ).format(DateTime.now().add(Duration(days: 365))), // Tạm
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/thuoc/${thuoc.maThuoc}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/thuoc', payload);
                  }

                  if (!mounted || !ctx.mounted) return;

                  if (response.statusCode == 200 ||
                      response.statusCode == 201) {
                    Navigator.of(ctx).pop();
                    _fetchData();
                  } else {
                    _showError('Lỗi: ${jsonDecode(response.body)['message']}');
                  }
                } catch (e) {
                  _showError('Lỗi kết nối: $e');
                }
              },
              child: Text(isEdit ? 'Cập nhật' : 'Thêm'),
            ),
          ],
        );
      },
    );
  }

  Future<bool?> _showConfirmDialog(String title, String content) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Xác nhận', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Quản lý Thuốc'),
        backgroundColor: Color(0xFF2C3E50),
        // SỬA: Bỏ 'leading' và thêm 'actions'
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/admin'),
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
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEditDialog(),
        tooltip: 'Thêm thuốc',
        child: Icon(Icons.add),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _list.length,
              itemBuilder: (context, index) {
                final item = _list[index];
                return Card(
                  margin: EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.purple[100],
                      child: FaIcon(
                        FontAwesomeIcons.capsules,
                        color: Colors.purple[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      item.tenThuoc,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Nhóm: ${item.tenNhom} - Tồn kho: ${item.tonKho} ${item.tenDVT}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.edit,
                            color: Colors.orange[700],
                            size: 20,
                          ),
                          onPressed: () {
                            // Cần gọi API chi tiết /api/thuoc/:id để lấy đủ dữ liệu
                            // Tạm thời bỏ qua
                          },
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(item.maThuoc),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
