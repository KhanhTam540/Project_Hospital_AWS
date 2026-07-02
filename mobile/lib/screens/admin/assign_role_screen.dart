import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../models/user_model.dart';
import '../../services/api_client.dart';

// Helper API
final ApiClient _api = ApiClient();

class AssignRoleScreen extends StatefulWidget {
  const AssignRoleScreen({super.key});

  @override
  State<AssignRoleScreen> createState() => _AssignRoleScreenState();
}

class _AssignRoleScreenState extends State<AssignRoleScreen> {
  List<UserModel> _users = [];
  bool _isLoading = true;
  String _error = '';

  Map<String, String> _updatedRoles = {};
  final List<String> _roles = ['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN'];

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoading = true;
      _updatedRoles = <String, String>{};
      _error = '';
    });

    try {
      final response = await _api.get('/tai-khoan');
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        final body = decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{};
        final data = body['data'] is Map<String, dynamic>
            ? body['data'] as Map<String, dynamic>
            : <String, dynamic>{};
        final List<dynamic> usersData = data['users'] is List
            ? data['users'] as List<dynamic>
            : const [];
        final users = usersData
            .whereType<Map>()
            .map((json) => UserModel.fromJson(Map<String, dynamic>.from(json)))
            .toList();

        if (!mounted) {
          return;
        }
        setState(() {
          _users = users;
        });
      } else {
        final decoded = jsonDecode(response.body);
        final errorBody = decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{};

        if (!mounted) {
          return;
        }
        setState(() {
          _error =
              errorBody['message']?.toString() ??
              'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch tÃ i khoáº£n.';
        });
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = 'Lá»—i káº¿t ná»‘i: $error';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _handleChangeRole(String maTK, String? newRole) {
    // Logic khi thay Ä‘á»•i Dropdown
    if (newRole != null) {
      setState(() {
        _updatedRoles[maTK] = newRole;
      });
    }
  }

  Future<void> _handleSave(UserModel user) async {
    final newRole = _updatedRoles[user.maTK] ?? user.maNhom;

    if (newRole == user.maNhom) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('KhÃ´ng cÃ³ thay Ä‘á»•i Ä‘á»ƒ lÆ°u.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final accountIdentifier = user.username.trim().isNotEmpty
          ? user.username.trim()
          : user.maTK;
      final encodedIdentifier = Uri.encodeComponent(accountIdentifier);
      final response = await _api.put('/tai-khoan/$encodedIdentifier', {
        'role': newRole,
        'maNhom': newRole,
      });

      if (!mounted) {
        return;
      }

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'ÄÃ£ gÃ¡n quyá»n $newRole cho ${user.tenDangNhap}.',
            ),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        final decoded = jsonDecode(response.body);
        final errorBody = decoded is Map<String, dynamic>
            ? decoded
            : <String, dynamic>{};
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Thao tÃ¡c tháº¥t báº¡i: '
              '${errorBody['message']?.toString() ?? 'Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh'}',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lá»—i API: $error'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        await _fetchUsers();
      }
    }
  }

  // --- HÃ€M HELPER Má»šI Äá»‚ Láº¤Y MÃ€U CHO VAI TRÃ’ ---
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(
        context,
      ).scaffoldBackgroundColor, // MÃ u ná»n cho toÃ n trang
      appBar: AppBar(
        title: const Text('PhÃ¢n quyá»n ngÆ°á»i dÃ¹ng'),
        backgroundColor: Theme.of(context).colorScheme.primary, // MÃ u AppBar
        actions: [
          // NÃºt Trang chá»§
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/admin'),
          ),
          // NÃºt ÄÄƒng xuáº¥t
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
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // --- Header ---
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'ðŸ›¡ï¸ PhÃ¢n quyá»n ngÆ°á»i dÃ¹ng',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Color(0xFF2C3E50), // MÃ u tiÃªu Ä‘á»
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: FaIcon(
                    FontAwesomeIcons.arrowsRotate,
                    size: 20,
                    color: Colors.blue[700],
                  ),
                  onPressed: _isLoading ? null : _fetchUsers,
                  tooltip: 'Táº£i láº¡i danh sÃ¡ch',
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              'Chá»n tÃ i khoáº£n vÃ  gÃ¡n quyá»n má»›i bÃªn dÆ°á»›i.',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: Colors.grey[600]),
            ),
            const SizedBox(height: 20),

            // --- Ná»™i dung chÃ­nh ---
            if (_isLoading)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(32.0),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error.isNotEmpty)
              Center(
                child: Text(_error, style: TextStyle(color: Colors.red)),
              )
            else
              // Sá»­ dá»¥ng ListView.builder Ä‘á»ƒ táº¡o danh sÃ¡ch Card
              ListView.builder(
                itemCount: _users.length,
                shrinkWrap:
                    true, // Cáº§n thiáº¿t khi lá»“ng trong SingleChildScrollView
                physics:
                    const NeverScrollableScrollPhysics(), // Cáº§n thiáº¿t khi lá»“ng
                itemBuilder: (context, index) {
                  final user = _users[index];
                  return _buildUserCard(user); // Widget Card má»›i
                },
              ),
          ],
        ),
      ),
    );
  }

  // --- WIDGET Má»šI: _buildUserCard ---
  Widget _buildUserCard(UserModel user) {
    // Láº¥y vai trÃ² Ä‘Ã£ chá»n (náº¿u cÃ³ thay Ä‘á»•i) hoáº·c vai trÃ² hiá»‡n táº¡i
    final selectedRole = _updatedRoles[user.maTK] ?? user.maNhom;
    // Kiá»ƒm tra xem cÃ³ thay Ä‘á»•i khÃ´ng
    final hasChange = selectedRole != user.maNhom;

    return Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8.0),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // --- ThÃ´ng tin User (Avatar, TÃªn, Email) ---
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  radius: 20,
                  child: FaIcon(
                    FontAwesomeIcons.user,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.tenDangNhap,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user.email ?? '-',
                        style: TextStyle(color: Colors.grey[600], fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 16),

            // --- Pháº§n GÃ¡n Quyá»n ---
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // --- Quyá»n hiá»‡n táº¡i (DÃ¹ng Chip) ---
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Quyá»n hiá»‡n táº¡i:',
                        style: TextStyle(color: Colors.grey[700], fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Chip(
                        label: Text(
                          user.maNhom,
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13,
                          ),
                        ),
                        backgroundColor: _getRoleColor(
                          user.maNhom,
                        ), // DÃ¹ng mÃ u theo vai trÃ²
                        padding: EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        visualDensity: VisualDensity(
                          horizontal: 0.0,
                          vertical: -4,
                        ), // LÃ m chip nhá» láº¡i
                      ),
                    ],
                  ),
                ),
                // --- MÅ©i tÃªn ---
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0),
                  child: FaIcon(
                    FontAwesomeIcons.arrowRightLong,
                    color: Colors.grey[400],
                    size: 20,
                  ),
                ),
                // --- GÃ¡n quyá»n má»›i (Dropdown) ---
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'GÃ¡n quyá»n má»›i:',
                        style: TextStyle(color: Colors.grey[700], fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 0,
                        ),
                        decoration: BoxDecoration(
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: selectedRole,
                            items: _roles
                                .map(
                                  (role) => DropdownMenuItem<String>(
                                    value: role,
                                    child: Text(role),
                                  ),
                                )
                                .toList(),
                            onChanged: (String? newValue) {
                              _handleChangeRole(user.maTK, newValue);
                            },
                            style: TextStyle(
                              color: Colors.black87,
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                            dropdownColor: Theme.of(
                              context,
                            ).colorScheme.surface,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // --- NÃºt LÆ°u (Chá»‰ hiá»‡n khi cÃ³ thay Ä‘á»•i) ---
            if (hasChange) ...[
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _handleSave(user),
                  icon: FaIcon(FontAwesomeIcons.solidFloppyDisk, size: 16),
                  label: Text('LÆ°u thay Ä‘á»•i'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green[600],
                    foregroundColor: Colors.white,
                    padding: EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    textStyle: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
