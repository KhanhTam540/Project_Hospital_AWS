// lib/screens/admin/quan_ly_benh_nhan_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // DÃ¹ng UserModel

class QuanLyBenhNhanScreen extends StatefulWidget {
  const QuanLyBenhNhanScreen({super.key});

  @override
  State<QuanLyBenhNhanScreen> createState() => _QuanLyBenhNhanScreenState();
}

class _QuanLyBenhNhanScreenState extends State<QuanLyBenhNhanScreen> {
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
      final response = await _api.get('/benhnhan');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          // API /api/benhnhan tráº£ vá» model BenhNhan, ta táº¡m dÃ¹ng UserModel
          _list = data.map((json) => UserModel.fromJson(json)).toList();
        });
      }
    } catch (e) {
      _showError('Lá»—i táº£i dá»¯ liá»‡u: $e');
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

  void _handleEdit(UserModel user) {
    context.go('/admin/account/create', extra: user);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Quáº£n lÃ½ Bá»‡nh nhÃ¢n'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        // Sá»¬A: Bá» 'leading' vÃ  thÃªm 'actions'
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
        tooltip: 'ThÃªm bá»‡nh nhÃ¢n',
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
                      FontAwesomeIcons.users,
                      color: Colors.red[700],
                    ),
                    title: Text(
                      user.hoTen ?? user.tenDangNhap,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'SÄT: ${user.soDienThoai ?? 'N/A'} - BHYT: ${user.bhyt ?? 'N/A'}',
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
