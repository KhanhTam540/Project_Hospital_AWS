// lib/screens/admin/user_management_screen.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../models/user_model.dart';
import '../../services/api_client.dart';

class UserManagementScreen extends StatefulWidget {
  const UserManagementScreen({super.key});

  @override
  State<UserManagementScreen> createState() => _UserManagementScreenState();
}

class _UserManagementScreenState extends State<UserManagementScreen> {
  // (Giữ nguyên phần state, initState, _fetchUsers, _groupUsers, _handleEdit, _handleDelete)
  bool _isLoading = true;
  String _error = '';
  Map<String, List<UserModel>> _groupedUsers = {
    'ADMIN': [],
    'BACSI': [],
    'NHANSU': [],
    'BENHNHAN': [],
  };

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });
    try {
      final response = await ApiClient().get('/tai-khoan');

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
        _groupUsers(users);
      } else {
        final errorBody = jsonDecode(response.body);
        setState(() {
          _error = errorBody['message'] ?? 'Không thể tải dữ liệu';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Lỗi kết nối: $e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _groupUsers(List<UserModel> users) {
    _groupedUsers = {'ADMIN': [], 'BACSI': [], 'NHANSU': [], 'BENHNHAN': []};
    for (var user in users) {
      if (_groupedUsers.containsKey(user.maNhom)) {
        _groupedUsers[user.maNhom]!.add(user);
      }
    }
  }

  void _handleEdit(UserModel user) {
    context.go('/admin/account/create', extra: user);
  }

  Future<void> _handleDelete(UserModel user) async {
    final accountIdentifier = user.username.trim().isNotEmpty
        ? user.username.trim()
        : user.maTK;
    final encodedIdentifier = Uri.encodeComponent(accountIdentifier);
    bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Xác nhận xoá'),
        content: Text(
          'Bạn có chắc chắn muốn xoá tài khoản này? Mọi dữ liệu liên quan sẽ bị mất.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Xoá', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      final response = await ApiClient().delete(
        '/tai-khoan/$encodedIdentifier',
      );
      if (!mounted) return;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã xoá tài khoản $accountIdentifier'),
            backgroundColor: Colors.green,
          ),
        );
        _fetchUsers();
      } else {
        final errorBody = jsonDecode(response.body);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${errorBody['message']}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi kết nối: $e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Quản lý tài khoản'),
        backgroundColor: Color(0xFF2C3E50), // Thống nhất màu
        actions: [
          // THÊM NÚT HOME
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/admin'),
          ),
          IconButton(
            icon: Icon(Icons.add_circle_outline, color: Colors.white, size: 26),
            tooltip: 'Tạo tài khoản mới',
            onPressed: () => context.go('/admin/account/create'),
          ),
          IconButton(
            icon: Icon(Icons.refresh, color: Colors.white, size: 26),
            tooltip: 'Tải lại',
            onPressed: _fetchUsers,
          ),
          // THÊM NÚT ĐĂNG XUẤT
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
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : _error.isNotEmpty
          ? Center(
              child: Text(_error, style: TextStyle(color: Colors.red)),
            )
          : ListView(
              padding: EdgeInsets.all(16),
              children: [
                _buildUserSection(
                  '🟦 Quản trị viên (ADMIN)',
                  _groupedUsers['ADMIN']!,
                  _buildAdminColumns(),
                  _buildAdminRows,
                ),
                _buildUserSection(
                  '🟩 Bác sĩ (BACSI)',
                  _groupedUsers['BACSI']!,
                  _buildBacSiColumns(),
                  _buildBacSiRows,
                ),
                _buildUserSection(
                  '🟨 Nhân viên y tế (NHANSU)',
                  _groupedUsers['NHANSU']!,
                  _buildNhanSuColumns(),
                  _buildNhanSuRows,
                ),
                _buildUserSection(
                  '🟧 Bệnh nhân (BENHNHAN)',
                  _groupedUsers['BENHNHAN']!,
                  _buildBenhNhanColumns(),
                  _buildBenhNhanRows,
                ),
              ],
            ),
    );
  }

  // --- WIDGETS CON ---
  // (Giữ nguyên _buildUserSection, _buildCommonColumns, _buildActionsColumn, _buildActionsCell, _buildTrangThaiCell, và 4 nhóm hàm cho các vai trò)
  // ...
  Widget _buildUserSection(
    String title,
    List<UserModel> users,
    List<DataColumn> columns,
    List<DataRow> Function(List<UserModel>) rowBuilder,
  ) {
    return Card(
      elevation: 3,
      margin: EdgeInsets.only(bottom: 20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: Color(0xFF34495E),
              ),
            ),
            SizedBox(height: 12),
            users.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(8.0),
                      child: Text(
                        'Không có tài khoản nào.',
                        style: TextStyle(fontStyle: FontStyle.italic),
                      ),
                    ),
                  )
                : SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: columns,
                      rows: rowBuilder(users),
                      columnSpacing: 20,
                      dataRowMinHeight: 48,
                      dataRowMaxHeight: 64,
                      headingRowColor: WidgetStateProperty.all(Colors.grey[50]),
                    ),
                  ),
          ],
        ),
      ),
    );
  }

  List<DataColumn> _buildCommonColumns() {
    return [
      DataColumn(label: Text('Mã TK')),
      DataColumn(label: Text('Tên đăng nhập')),
      DataColumn(label: Text('Email')),
      DataColumn(label: Text('Trạng thái')),
    ];
  }

  DataColumn _buildActionsColumn() {
    return DataColumn(label: Text('Thao tác'));
  }

  DataCell _buildActionsCell(UserModel user) {
    return DataCell(
      Row(
        mainAxisSize: MainAxisSize.min, // Giữ cho các nút gần nhau
        children: [
          IconButton(
            icon: Icon(Icons.edit, color: Colors.orange[700]),
            tooltip: 'Sửa',
            iconSize: 20, // Giảm kích thước
            splashRadius: 20,
            onPressed: () => _handleEdit(user),
          ),
          IconButton(
            icon: Icon(Icons.delete, color: Colors.red[700]),
            tooltip: 'Xoá',
            iconSize: 20,
            splashRadius: 20,
            onPressed: () => _handleDelete(user),
          ),
        ],
      ),
    );
  }

  DataCell _buildTrangThaiCell(bool trangThai) {
    return DataCell(
      Icon(
        trangThai ? Icons.check_circle : Icons.cancel,
        color: trangThai ? Colors.green : Colors.grey,
        size: 20,
      ),
    );
  }

  // 1. ADMIN
  List<DataColumn> _buildAdminColumns() {
    return [..._buildCommonColumns(), _buildActionsColumn()];
  }

  List<DataRow> _buildAdminRows(List<UserModel> users) {
    return users
        .map(
          (user) => DataRow(
            cells: [
              DataCell(Text(user.maTK)),
              DataCell(Text(user.tenDangNhap)),
              DataCell(Text(user.email ?? '-')),
              _buildTrangThaiCell(user.trangThai),
              _buildActionsCell(user),
            ],
          ),
        )
        .toList();
  }

  // 2. BÁC SĨ
  List<DataColumn> _buildBacSiColumns() {
    return [
      ..._buildCommonColumns(),
      DataColumn(label: Text('Họ tên')),
      DataColumn(label: Text('Khoa')),
      DataColumn(label: Text('Chuyên môn')),
      DataColumn(label: Text('Chức vụ')),
      _buildActionsColumn(),
    ];
  }

  List<DataRow> _buildBacSiRows(List<UserModel> users) {
    return users
        .map(
          (user) => DataRow(
            cells: [
              DataCell(Text(user.maTK)),
              DataCell(Text(user.tenDangNhap)),
              DataCell(Text(user.email ?? '-')),
              _buildTrangThaiCell(user.trangThai),
              DataCell(Text(user.hoTen ?? '-')),
              DataCell(Text(user.tenKhoa ?? user.maKhoa ?? '-')),
              DataCell(Text(user.chuyenMon ?? '-')),
              DataCell(Text(user.chucVu ?? '-')),
              _buildActionsCell(user),
            ],
          ),
        )
        .toList();
  }

  // 3. NHÂN SỰ
  List<DataColumn> _buildNhanSuColumns() {
    return [
      ..._buildCommonColumns(),
      DataColumn(label: Text('Họ tên')),
      DataColumn(label: Text('Khoa')),
      DataColumn(label: Text('Loại NS')),
      DataColumn(label: Text('Cấp bậc')),
      _buildActionsColumn(),
    ];
  }

  List<DataRow> _buildNhanSuRows(List<UserModel> users) {
    return users
        .map(
          (user) => DataRow(
            cells: [
              DataCell(Text(user.maTK)),
              DataCell(Text(user.tenDangNhap)),
              DataCell(Text(user.email ?? '-')),
              _buildTrangThaiCell(user.trangThai),
              DataCell(Text(user.hoTen ?? '-')),
              DataCell(Text(user.tenKhoa ?? user.maKhoa ?? '-')),
              DataCell(Text(user.loaiNS ?? '-')),
              DataCell(Text(user.capBac ?? '-')),
              _buildActionsCell(user),
            ],
          ),
        )
        .toList();
  }

  // 4. BỆNH NHÂN
  List<DataColumn> _buildBenhNhanColumns() {
    return [
      ..._buildCommonColumns(),
      DataColumn(label: Text('Họ tên')),
      DataColumn(label: Text('SĐT')),
      DataColumn(label: Text('BHYT')),
      _buildActionsColumn(),
    ];
  }

  List<DataRow> _buildBenhNhanRows(List<UserModel> users) {
    return users
        .map(
          (user) => DataRow(
            cells: [
              DataCell(Text(user.maTK)),
              DataCell(Text(user.tenDangNhap)),
              DataCell(Text(user.email ?? '-')),
              _buildTrangThaiCell(user.trangThai),
              DataCell(Text(user.hoTen ?? '-')),
              DataCell(Text(user.soDienThoai ?? '-')),
              DataCell(Text(user.bhyt ?? '-')),
              _buildActionsCell(user),
            ],
          ),
        )
        .toList();
  }
}
