// lib/screens/admin/quan_ly_nhom_thuoc_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

// Model
class NhomThuocModel {
  final String maNhom;
  final String tenNhom;
  final String? moTa;

  NhomThuocModel({required this.maNhom, required this.tenNhom, this.moTa});

  factory NhomThuocModel.fromJson(Map<String, dynamic> json) {
    return NhomThuocModel(
      maNhom: json['maNhom'],
      tenNhom: json['tenNhom'],
      moTa: json['moTa'],
    );
  }
}

class QuanLyNhomThuocScreen extends StatefulWidget {
  const QuanLyNhomThuocScreen({super.key});

  @override
  State<QuanLyNhomThuocScreen> createState() => _QuanLyNhomThuocScreenState();
}

class _QuanLyNhomThuocScreenState extends State<QuanLyNhomThuocScreen> {
  final ApiClient _api = ApiClient();
  List<NhomThuocModel> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final response = await _api.get('/thuoc/nhomthuoc');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data.map((json) => NhomThuocModel.fromJson(json)).toList();
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

  Future<void> _handleDelete(String maNhom) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá $maNhom?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/thuoc/nhomthuoc/$maNhom');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  Future<void> _showAddEditDialog({NhomThuocModel? nhom}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = nhom != null;
    final tenController = TextEditingController(text: nhom?.tenNhom);
    final moTaController = TextEditingController(text: nhom?.moTa);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sửa Nhóm Thuốc' : 'Thêm Nhóm Thuốc'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: tenController,
                  decoration: InputDecoration(
                    labelText: 'Tên nhóm',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v!.isEmpty ? 'Không được bỏ trống' : null,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: moTaController,
                  decoration: InputDecoration(
                    labelText: 'Mô tả',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
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

                final payload = {
                  'tenNhom': tenController.text,
                  'moTa': moTaController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/thuoc/nhomthuoc/${nhom.maNhom}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/thuoc/nhomthuoc', payload);
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
        title: Text('Quản lý Nhóm Thuốc'),
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
        tooltip: 'Thêm nhóm thuốc',
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
                      backgroundColor: Colors.deepPurple[100],
                      child: FaIcon(
                        FontAwesomeIcons.tags,
                        color: Colors.deepPurple[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      item.tenNhom,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(item.moTa ?? 'Mã: ${item.maNhom}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.edit,
                            color: Colors.orange[700],
                            size: 20,
                          ),
                          onPressed: () => _showAddEditDialog(nhom: item),
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(item.maNhom),
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
