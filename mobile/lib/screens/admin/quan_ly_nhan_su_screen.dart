// lib/screens/admin/quan_ly_nhan_su_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // DÃ¹ng UserModel

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
          // API /api/nhansu tráº£ vá» model NhanSuYTe, ta cáº§n parse nÃ³
          // Táº¡m thá»i dÃ¹ng UserModel vÃ¬ nÃ³ gáº§n giá»‘ng
          _list = data.map((json) => UserModel.fromJson(json)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      _showError('Lá»—i táº£i dá»¯ liá»‡u: $e');
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
    // Chuyá»ƒn Ä‘áº¿n trang Sá»­a (dÃ¹ng láº¡i trang Create)
    // Cáº§n Ä‘áº£m báº£o UserModel Ä‘Ã£ Ä‘Æ°á»£c fetch Ä‘áº§y Ä‘á»§
    context.go('/admin/account/create', extra: user);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Quáº£n lÃ½ NhÃ¢n viÃªn Y táº¿'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        // THÃŠM NÃšT
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
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.go('/admin/account/create'),
        tooltip: 'ThÃªm nhÃ¢n viÃªn', // Äi Ä‘áº¿n trang táº¡o má»›i
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
                    ), // Sá»­a icon
                    title: Text(
                      user.hoTen ?? user.tenDangNhap,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Loáº¡i: ${user.loaiNS ?? 'N/A'} - Khoa: ${user.tenKhoa ?? 'N/A'}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(Icons.edit, color: Colors.orange),
                          onPressed: () => _handleEdit(user),
                        ),
                        // NÃºt XÃ³a (thÆ°á»ng náº±m á»Ÿ user_management_screen)
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
