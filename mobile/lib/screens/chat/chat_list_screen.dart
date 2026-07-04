// lib/screens/chat/chat_list_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_provider.dart';
import '../../services/chat_service.dart';
import '../../models/user_model.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  late Future<List<UserModel>> _contactsFuture;

  @override
  void initState() {
    super.initState();
    _contactsFuture = ChatService().getContacts();
  }

  // (Giữ nguyên các hàm helper _getRoleColor, _getRoleIcon)
  Color _getRoleColor(String role) {
    switch (role) {
      case 'ADMIN':
        return Colors.red[600]!;
      case 'BACSI':
        return Colors.blue[600]!;
      case 'NHANSU':
        return Colors.orange[600]!;
      case 'BENHNHAN':
        return Colors.green[600]!;
      default:
        return Colors.grey;
    }
  }

  FaIconData _getRoleIcon(String role) {
    switch (role) {
      case 'ADMIN':
        return FontAwesomeIcons.userShield;
      case 'BACSI':
        return FontAwesomeIcons.userDoctor;
      case 'NHANSU':
        return FontAwesomeIcons.userNurse;
      case 'BENHNHAN':
        return FontAwesomeIcons.userInjured;
      default:
        return FontAwesomeIcons.user;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Chat nội bộ'),
        backgroundColor: Color(0xFF2C3E50),
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            // --- SỬA Ở ĐÂY ---
            // Nút Home động dựa trên vai trò
            onPressed: () {
              final auth = Provider.of<AuthProvider>(context, listen: false);
              final role = auth.role;
              final loaiNS = auth.loaiNS;
              String homeRoute = '/login'; // Mặc định

              switch (role) {
                case 'ADMIN':
                  homeRoute = '/admin';
                  break;
                case 'BACSI':
                  homeRoute = '/doctor';
                  break;
                case 'BENHNHAN':
                  homeRoute = '/patient';
                  break;
                case 'NHANSU':
                  switch (loaiNS) {
                    case 'YT':
                      homeRoute = '/yta';
                      break;
                    case 'XN':
                      homeRoute = '/xetnghiem';
                      break;
                    case 'TN':
                      homeRoute = '/tiepnhan';
                      break;
                  }
                  break;
              }
              context.go(homeRoute);
            },
            // --- KẾT THÚC SỬA ---
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
      // (Giữ nguyên phần body)
      body: FutureBuilder<List<UserModel>>(
        future: _contactsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Lỗi tải danh bạ: ${snapshot.error}'));
          }
          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(child: Text('Không tìm thấy ai trong danh bạ.'));
          }

          final contacts = snapshot.data!;
          return ListView.builder(
            padding: EdgeInsets.all(12),
            itemCount: contacts.length,
            itemBuilder: (context, index) {
              final contact = contacts[index];
              return Card(
                elevation: 2,
                margin: const EdgeInsets.symmetric(vertical: 6.0),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ListTile(
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  leading: CircleAvatar(
                    backgroundColor: _getRoleColor(contact.maNhom),
                    radius: 22,
                    child: FaIcon(
                      _getRoleIcon(contact.maNhom),
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  title: Text(
                    contact.hoTen ?? contact.tenDangNhap,
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  subtitle: Text(
                    'Vai trò: ${contact.maNhom}',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  trailing: Icon(Icons.chevron_right, color: Colors.grey[400]),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Sẽ mở chat với ${contact.tenDangNhap}'),
                      ),
                    );
                    // TODO: Khi có socket
                    // context.push('/chat/window', extra: contact);
                  },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
