// lib/screens/admin/quan_ly_loai_xet_nghiem_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

// Model
class LoaiXetNghiemModel {
  final String maLoaiXN;
  final String tenLoai;
  final String? moTa;

  LoaiXetNghiemModel({
    required this.maLoaiXN,
    required this.tenLoai,
    this.moTa,
  });

  factory LoaiXetNghiemModel.fromJson(Map<String, dynamic> json) {
    return LoaiXetNghiemModel(
      maLoaiXN: json['maLoaiXN'],
      tenLoai: json['tenLoai'],
      moTa: json['moTa'],
    );
  }
}

class QuanLyLoaiXNScreen extends StatefulWidget {
  const QuanLyLoaiXNScreen({super.key});

  @override
  State<QuanLyLoaiXNScreen> createState() => _QuanLyLoaiXNScreenState();
}

class _QuanLyLoaiXNScreenState extends State<QuanLyLoaiXNScreen> {
  final ApiClient _api = ApiClient();
  List<LoaiXetNghiemModel> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final response = await _api.get('/loaixetnghiem');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data
              .map((json) => LoaiXetNghiemModel.fromJson(json))
              .toList();
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

  Future<void> _handleDelete(String maLoaiXN) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá $maLoaiXN?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/loaixetnghiem/$maLoaiXN');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  Future<void> _showAddEditDialog({LoaiXetNghiemModel? loai}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = loai != null;
    final tenController = TextEditingController(text: loai?.tenLoai);
    final moTaController = TextEditingController(text: loai?.moTa);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sửa Loại XN' : 'Thêm Loại XN'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: tenController,
                  decoration: InputDecoration(
                    labelText: 'Tên loại',
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
                  'tenLoai': tenController.text,
                  'moTa': moTaController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/loaixetnghiem/${loai.maLoaiXN}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/loaixetnghiem', payload);
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
        title: Text('Quản lý Loại Xét nghiệm'),
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
        tooltip: 'Thêm loại xét nghiệm',
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
                      backgroundColor: Colors.red[100],
                      child: FaIcon(
                        FontAwesomeIcons.vials,
                        color: Colors.red[800],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      item.tenLoai,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(item.moTa ?? 'Mã: ${item.maLoaiXN}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.edit,
                            color: Colors.orange[700],
                            size: 20,
                          ),
                          onPressed: () => _showAddEditDialog(loai: item),
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(item.maLoaiXN),
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
