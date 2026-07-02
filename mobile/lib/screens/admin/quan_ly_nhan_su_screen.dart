// lib/screens/admin/quan_ly_nhan_su_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // Dùng UserModel

class QuanLyNhanSuScreen extends StatefulWidget {
  const QuanLyNhanSuScreen({super.key});

  @override
  State<QuanLyNhanSuScreen> createState() => _QuanLyNhanSuScreenState();
}

class _QuanLyNhanSuScreenState extends State<QuanLyNhanSuScreen> {
  final ApiClient _api = ApiClient();
  List<UserModel> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // Backend: /api/nhansu
      final response = await _api.get('/nhansu');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          // API /api/nhansu trả về model NhanSuYTe, ta cần parse nó
          // Tạm thời dùng UserModel vì nó gần giống
          _list = data.map((json) => UserModel.fromJson(json)).toList();
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

  void _handleEdit(UserModel user) {
    // Chuyển đến trang Sửa (dùng lại trang Create)
    // Cần đảm bảo UserModel đã được fetch đầy đủ
    context.go('/admin/account/create', extra: user);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Quản lý Nhân viên Y tế'),
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
        onPressed: () =>
            context.go('/admin/account/create'),
        tooltip: 'Thêm nhân viên', // Đi đến trang tạo mới
        child: Icon(Icons.add),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _list.length,
              itemBuilder: (context, index) {
                final user = _list[index];
                return Card(
                  margin: EdgeInsets.only(bottom: 10),
                  elevation: 2,
                  child: ListTile(
                    leading: FaIcon(
                      FontAwesomeIcons.userNurse,
                      color: Colors.cyan[700],
                    ), // Sửa icon
                    title: Text(
                      user.hoTen ?? user.tenDangNhap,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Loại: ${user.loaiNS ?? 'N/A'} - Khoa: ${user.tenKhoa ?? 'N/A'}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(Icons.edit, color: Colors.orange),
                          onPressed: () => _handleEdit(user),
                        ),
                        // Nút Xóa (thường nằm ở user_management_screen)
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
