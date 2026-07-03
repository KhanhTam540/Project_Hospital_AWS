// lib/screens/admin/quan_ly_tro_ly_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart'; // Thêm import
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // Dùng UserModel để lấy DS Bác sĩ/Nhân sự

// Model
class TroLyModel {
  final String maTroLy;
  final String maNS;
  final String maBacSi;
  final String? phamViUyQuyen;

  TroLyModel({
    required this.maTroLy,
    required this.maNS,
    required this.maBacSi,
    this.phamViUyQuyen,
  });

  factory TroLyModel.fromJson(Map<String, dynamic> json) {
    return TroLyModel(
      maTroLy: json['maTroLy'],
      maNS: json['maNS'],
      maBacSi: json['maBacSi'],
      phamViUyQuyen: json['phamViUyQuyen'],
    );
  }
}

class QuanLyTroLyScreen extends StatefulWidget {
  const QuanLyTroLyScreen({super.key});

  @override
  State<QuanLyTroLyScreen> createState() => _QuanLyTroLyScreenState();
}

class _QuanLyTroLyScreenState extends State<QuanLyTroLyScreen> {
  final ApiClient _api = ApiClient();
  List<TroLyModel> _list = [];
  List<UserModel> _nhanSuList = [];
  List<UserModel> _bacSiList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // Backend: /api/tro-ly (controller.js) trả về { data: { items: [...] } }
      final resTroLy = await _api.get('/tro-ly');
      final resUsers = await _api.get('/tai-khoan');

      if (resTroLy.statusCode == 200 && resUsers.statusCode == 200) {
        final dataTroLy = jsonDecode(resTroLy.body)['data']['items'] as List;
        final dataUsers = jsonDecode(resUsers.body)['data'] as List;

        final allUsers = dataUsers
            .map((json) => UserModel.fromJson(json))
            .toList();

        setState(() {
          _list = dataTroLy.map((json) => TroLyModel.fromJson(json)).toList();
          // Lọc ra danh sách BS và NS (loại YT - Y tá) để điền vào dropdown
          _bacSiList = allUsers.where((u) => u.maNhom == 'BACSI').toList();
          _nhanSuList = allUsers
              .where((u) => u.maNhom == 'NHANSU' && u.loaiNS == 'YT')
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      _showError('Lỗi tải dữ liệu: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
    setState(() => _isLoading = false);
  }

  Future<void> _handleDelete(String maTroLy) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá phân công này?',
    );
    if (confirm != true) return;

    try {
      final response = await _api.delete('/tro-ly/$maTroLy');
      if (!mounted) return;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('✅ Đã xoá'), backgroundColor: Colors.green),
        );
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  Future<void> _showAddEditDialog({TroLyModel? troLy}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = troLy != null;

    String? selectedNS = isEdit ? troLy.maNS : null;
    String? selectedBS = isEdit ? troLy.maBacSi : null;
    final phamViController = TextEditingController(text: troLy?.phamViUyQuyen);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sửa Phân công' : 'Thêm Trợ lý'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Nhân viên Y tá',
                    border: OutlineInputBorder(),
                  ),
                  initialValue: selectedNS,
                  items: _nhanSuList
                      .map(
                        (ns) => DropdownMenuItem<String>(
                          value: ns.maNS,
                          child: Text(ns.hoTen ?? ns.tenDangNhap),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => selectedNS = v,
                  validator: (v) => v == null ? 'Vui lòng chọn' : null,
                ),
                SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Bác sĩ phụ trách',
                    border: OutlineInputBorder(),
                  ),
                  initialValue: selectedBS,
                  items: _bacSiList
                      .map(
                        (bs) => DropdownMenuItem<String>(
                          value: bs.maBS,
                          child: Text(bs.hoTen ?? bs.tenDangNhap),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => selectedBS = v,
                  validator: (v) => v == null ? 'Vui lòng chọn' : null,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: phamViController,
                  decoration: InputDecoration(
                    labelText: 'Phạm vi uỷ quyền',
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
                  'maNS': selectedNS,
                  'maBacSi': selectedBS,
                  'phamViUyQuyen': phamViController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/tro-ly/${troLy.maTroLy}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/tro-ly', payload);
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
        title: Text('Quản lý Trợ lý Bác sĩ'),
        backgroundColor: Color(0xFF2C3E50),
        // THÊM NÚT
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
        tooltip: 'Phân công trợ lý',
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
                  elevation: 2,
                  child: ListTile(
                    leading: FaIcon(
                      FontAwesomeIcons.userSecret,
                      color: Colors.teal[700],
                    ),
                    title: Text(
                      'Y tá: ${item.maNS}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text('Hỗ trợ Bác sĩ: ${item.maBacSi}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(Icons.edit, color: Colors.orange),
                          onPressed: () => _showAddEditDialog(troLy: item),
                        ),
                        IconButton(
                          icon: Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _handleDelete(item.maTroLy),
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
