import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../models/user_model.dart';
import '../../services/api_client.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  bool _isLoading = true;
  String _error = '';

  final Map<String, List<UserModel>> _groupedUsers = {
    'ADMIN': <UserModel>[],
    'BACSI': <UserModel>[],
    'NHANSU': <UserModel>[],
    'BENHNHAN': <UserModel>[],
  };

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  String _apiError(dynamic decoded, String fallback) {
    if (decoded is Map<String, dynamic>) {
      final error = decoded['error'];
      if (error is Map && error['message'] != null) {
        return error['message'].toString();
      }
      if (decoded['message'] != null) {
        return decoded['message'].toString();
      }
    }
    return fallback;
  }

  List<UserModel> _decodeUsers(String responseBody) {
    final decoded = jsonDecode(responseBody);
    if (decoded is! Map) return const <UserModel>[];

    final body = Map<String, dynamic>.from(decoded);
    final rawData = body['data'];
    final data = rawData is Map
        ? Map<String, dynamic>.from(rawData)
        : <String, dynamic>{};

    // Core API: { success: true, data: { users: [...], count: n } }
    final rawUsers = data['users'];
    if (rawUsers is! List) return const <UserModel>[];

    return rawUsers
        .whereType<Map>()
        .map((item) => UserModel.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<void> _fetchUsers() async {
    if (mounted) {
      setState(() {
        _isLoading = true;
        _error = '';
      });
    }

    try {
      final response = await ApiClient().get('/tai-khoan');
      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _groupUsers(_decodeUsers(response.body));
      } else {
        final decoded = jsonDecode(response.body);
        setState(() {
          _error = _apiError(decoded, 'Không thể tải danh sách tài khoản');
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = 'Lỗi kết nối: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _groupUsers(List<UserModel> users) {
    for (final list in _groupedUsers.values) {
      list.clear();
    }

    for (final user in users) {
      final role = user.maNhom.toUpperCase();
      (_groupedUsers[role] ?? _groupedUsers['BENHNHAN']!).add(user);
    }

    setState(() {});
  }

  void _handleEdit(UserModel user) {
    context.go('/admin/account/create', extra: user);
  }

  Future<void> _handleDelete(UserModel user) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Xác nhận xóa'),
        content: Text('Bạn có chắc muốn xóa tài khoản ${user.username}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final encodedUsername = Uri.encodeComponent(user.username);
      final response = await ApiClient().delete('/tai-khoan/$encodedUsername');
      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        for (final list in _groupedUsers.values) {
          list.removeWhere((item) => item.username == user.username);
        }
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã xóa tài khoản ${user.username}'),
            backgroundColor: Colors.green,
          ),
        );
        await _fetchUsers();
      } else {
        final decoded = jsonDecode(response.body);
        throw Exception(_apiError(decoded, 'Không thể xóa tài khoản'));
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi: $error'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _logout() async {
    await context.read<AuthProvider>().logout();
    if (!mounted) return;
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F8),
      appBar: AppBar(
        title: const Text('Quản lý tài khoản'),
        backgroundColor: const Color(0xFF2C3E50),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/admin'),
            icon: const FaIcon(FontAwesomeIcons.house, size: 19),
          ),
          IconButton(
            tooltip: 'Tạo tài khoản',
            onPressed: () => context.go('/admin/account/create'),
            icon: const Icon(Icons.person_add_alt_1),
          ),
          IconButton(
            tooltip: 'Làm mới',
            onPressed: _fetchUsers,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Đăng xuất',
            onPressed: _logout,
            icon: const FaIcon(FontAwesomeIcons.rightFromBracket, size: 19),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              Text(_error, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _fetchUsers,
                icon: const Icon(Icons.refresh),
                label: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    final total = _groupedUsers.values.fold<int>(
      0,
      (sum, users) => sum + users.length,
    );

    if (total == 0) {
      return const Center(child: Text('Chưa có tài khoản nào.'));
    }

    return RefreshIndicator(
      onRefresh: _fetchUsers,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildRoleSection(
            'ADMIN',
            'Quản trị viên',
            Icons.admin_panel_settings,
          ),
          _buildRoleSection('BACSI', 'Bác sĩ', Icons.medical_services),
          _buildRoleSection('NHANSU', 'Nhân sự', Icons.badge),
          _buildRoleSection('BENHNHAN', 'Bệnh nhân', Icons.personal_injury),
        ],
      ),
    );
  }

  Widget _buildRoleSection(String role, String label, IconData icon) {
    final users = _groupedUsers[role] ?? const <UserModel>[];

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        initiallyExpanded: role == 'ADMIN',
        leading: CircleAvatar(child: Icon(icon)),
        title: Text(
          '$label (${users.length})',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        children: users.isEmpty
            ? const [
                Padding(
                  padding: EdgeInsets.all(20),
                  child: Text('Chưa có tài khoản trong nhóm này.'),
                ),
              ]
            : users.map(_buildUserTile).toList(),
      ),
    );
  }

  Widget _buildUserTile(UserModel user) {
    return ListTile(
      leading: Icon(
        user.trangThai ? Icons.check_circle : Icons.block,
        color: user.trangThai ? Colors.green : Colors.grey,
      ),
      title: Text(
        user.hoTen?.isNotEmpty == true ? user.hoTen! : user.username,
        style: const TextStyle(fontWeight: FontWeight.w600),
      ),
      subtitle: Text('${user.username}\n${user.email ?? 'Không có email'}'),
      isThreeLine: true,
      trailing: Wrap(
        spacing: 2,
        children: [
          IconButton(
            tooltip: 'Sửa',
            onPressed: () => _handleEdit(user),
            icon: const Icon(Icons.edit, color: Colors.orange),
          ),
          IconButton(
            tooltip: 'Xóa',
            onPressed: () => _handleDelete(user),
            icon: const Icon(Icons.delete, color: Colors.red),
          ),
        ],
      ),
    );
  }
}
