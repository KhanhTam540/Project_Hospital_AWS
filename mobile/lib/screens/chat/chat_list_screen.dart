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

  // (Giá»¯ nguyÃªn cÃ¡c hÃ m helper _getRoleColor, _getRoleIcon)
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Chat ná»™i bá»™'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            // --- Sá»¬A á»ž ÄÃ‚Y ---
            // NÃºt Home Ä‘á»™ng dá»±a trÃªn vai trÃ²
            onPressed: () {
              final auth = Provider.of<AuthProvider>(context, listen: false);
              final role = auth.role;
              final loaiNS = auth.loaiNS;
              String homeRoute = '/login'; // Máº·c Ä‘á»‹nh

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
            // --- Káº¾T THÃšC Sá»¬A ---
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
      // (Giá»¯ nguyÃªn pháº§n body)
      body: FutureBuilder<List<UserModel>>(
        future: _contactsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Text('Lá»—i táº£i danh báº¡: ${snapshot.error}'),
            );
          }
          if (!snapshot.hasData || snapshot.data!.isEmpty) {
            return Center(
              child: Text('KhÃ´ng tÃ¬m tháº¥y ai trong danh báº¡.'),
            );
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
                    'Vai trÃ²: ${contact.maNhom}',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                  trailing: Icon(Icons.chevron_right, color: Colors.grey[400]),
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Sáº½ má»Ÿ chat vá»›i ${contact.tenDangNhap}',
                        ),
                      ),
                    );
                    // TODO: Khi cÃ³ socket
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
