import 'dart:convert';

import 'package:flutter/material.dart';

import '../../models/user_model.dart';
import '../../services/api_client.dart';

class AssignRoleScreen extends StatefulWidget {
  const AssignRoleScreen({super.key});

  @override
  State<AssignRoleScreen> createState() => _AssignRoleScreenState();
}

class _AssignRoleScreenState extends State<AssignRoleScreen> {
  static const Map<String, String> _roles = {
    'ADMIN': 'Quản trị viên',
    'BACSI': 'Bác sĩ',
    'NHANSU': 'Nhân sự',
    'BENHNHAN': 'Bệnh nhân',
  };

  bool _isLoading = true;
  bool _isSaving = false;
  String _error = '';
  List<UserModel> _users = const [];
  UserModel? _selectedUser;
  String _selectedRole = 'BENHNHAN';

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
      if (decoded['message'] != null) return decoded['message'].toString();
    }
    return fallback;
  }

  Future<void> _fetchUsers() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    try {
      final response = await ApiClient().get('/tai-khoan');
      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        final body = decoded is Map
            ? Map<String, dynamic>.from(decoded)
            : <String, dynamic>{};
        final rawData = body['data'];
        final data = rawData is Map
            ? Map<String, dynamic>.from(rawData)
            : <String, dynamic>{};

        final rawUsers = data['users'];
        final users = rawUsers is List
            ? rawUsers
                  .whereType<Map>()
                  .map(
                    (item) =>
                        UserModel.fromJson(Map<String, dynamic>.from(item)),
                  )
                  .toList()
            : <UserModel>[];

        users.sort(
          (left, right) => left.username.toLowerCase().compareTo(
            right.username.toLowerCase(),
          ),
        );

        setState(() {
          _users = users;
          if (_selectedUser != null) {
            _selectedUser = users.cast<UserModel?>().firstWhere(
              (item) => item?.username == _selectedUser?.username,
              orElse: () => null,
            );
          }
        });
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

  Future<void> _assignRole() async {
    final user = _selectedUser;
    if (user == null) {
      _showMessage('Vui lòng chọn tài khoản', isError: true);
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final encodedUsername = Uri.encodeComponent(user.username);
      final response = await ApiClient().put('/tai-khoan/$encodedUsername', {
        'maNhom': _selectedRole,
      });

      if (!mounted) return;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _showMessage('Đã gán ${_roles[_selectedRole]} cho ${user.username}');
        await _fetchUsers();
      } else {
        final decoded = jsonDecode(response.body);
        throw Exception(_apiError(decoded, 'Không thể cập nhật vai trò'));
      }
    } catch (error) {
      if (!mounted) return;
      _showMessage('Lỗi: $error', isError: true);
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gán vai trò tài khoản'),
        actions: [
          IconButton(
            tooltip: 'Làm mới',
            onPressed: _isLoading ? null : _fetchUsers,
            icon: const Icon(Icons.refresh),
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
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
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

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Chọn tài khoản',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<UserModel>(
                  initialValue: _selectedUser,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.person),
                  ),
                  hint: const Text('-- Chọn tài khoản --'),
                  items: _users
                      .map(
                        (user) => DropdownMenuItem<UserModel>(
                          value: user,
                          child: Text(
                            '${user.username} — ${user.email ?? user.maNhom}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _isSaving
                      ? null
                      : (user) {
                          setState(() {
                            _selectedUser = user;
                            _selectedRole = user?.maNhom ?? 'BENHNHAN';
                          });
                        },
                ),
                const SizedBox(height: 20),
                const Text(
                  'Vai trò mới',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: _selectedRole,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.admin_panel_settings),
                  ),
                  items: _roles.entries
                      .map(
                        (entry) => DropdownMenuItem<String>(
                          value: entry.key,
                          child: Text(entry.value),
                        ),
                      )
                      .toList(),
                  onChanged: _isSaving
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() {
                            _selectedRole = value;
                          });
                        },
                ),
                const SizedBox(height: 24),
                FilledButton.icon(
                  onPressed: _isSaving ? null : _assignRole,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.save),
                  label: Text(_isSaving ? 'Đang cập nhật...' : 'Lưu vai trò'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
