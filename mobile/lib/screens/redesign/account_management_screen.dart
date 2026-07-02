import 'package:flutter/material.dart';

import '../../services/hospital_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/hospital_ui.dart';

class AccountManagementScreen extends StatefulWidget {
  const AccountManagementScreen({super.key});

  @override
  State<AccountManagementScreen> createState() => _AccountManagementScreenState();
}

class _AccountManagementScreenState extends State<AccountManagementScreen> {
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _searchController = TextEditingController();

  bool _loading = true;
  String? _error;
  String _query = '';
  List<Map<String, dynamic>> _accounts = const [];
  Map<String, dynamic> _summary = const {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _service.accounts(),
        _service.accountSummary(),
      ]);
      if (!mounted) return;
      setState(() {
        _accounts = results[0] as List<Map<String, dynamic>>;
        _summary = results[1] as Map<String, dynamic>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visible {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _accounts;
    return _accounts.where((account) {
      final text = account.values.map((value) => value.toString()).join(' ').toLowerCase();
      return text.contains(query);
    }).toList();
  }

  Future<void> _changeRole(Map<String, dynamic> account) async {
    final username = firstText(account, const ['username', 'tenDangNhap', 'email']);
    var selected = firstText(account, const ['primaryRole', 'maNhom', 'role'], fallback: 'BENHNHAN').toUpperCase();

    final result = await showDialog<String>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Cập nhật phân quyền'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(username, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: selected,
                    decoration: const InputDecoration(
                      labelText: 'Vai trò hệ thống',
                      prefixIcon: Icon(Icons.admin_panel_settings_rounded),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'ADMIN', child: Text('Quản trị viên')),
                      DropdownMenuItem(value: 'BACSI', child: Text('Bác sĩ')),
                      DropdownMenuItem(value: 'NHANSU', child: Text('Nhân sự y tế')),
                      DropdownMenuItem(value: 'BENHNHAN', child: Text('Bệnh nhân')),
                    ],
                    onChanged: (value) {
                      if (value != null) setDialogState(() => selected = value);
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Hủy'),
                ),
                FilledButton(
                  onPressed: () => Navigator.of(dialogContext).pop(selected),
                  child: const Text('Lưu thay đổi'),
                ),
              ],
            );
          },
        );
      },
    );

    if (result == null || result.isEmpty) return;
    try {
      await _service.updateAccountRole(username, result);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã cập nhật phân quyền.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Future<void> _disable(Map<String, dynamic> account) async {
    final username = firstText(account, const ['username', 'tenDangNhap', 'email']);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vô hiệu hóa tài khoản?'),
        content: Text('Tài khoản $username sẽ không thể đăng nhập sau thao tác này.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Vô hiệu hóa'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    try {
      await _service.disableAccount(username);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tài khoản đã được vô hiệu hóa.')),
      );
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    return HospitalPage(
      onRefresh: _load,
      children: [
        const PageHeader(
          title: 'Tài khoản và phân quyền',
          subtitle: 'Quản lý tài khoản Cognito và nhóm quyền của hệ thống.',
          icon: Icons.manage_accounts_rounded,
          badge: EndpointBadge(method: 'GET/PUT/DELETE', path: '/tai-khoan'),
        ),
        const SizedBox(height: 22),
        ResponsiveGrid(
          children: [
            MetricCard(
              label: 'Quản trị viên',
              value: '${_summary['admin'] ?? 0}',
              icon: Icons.admin_panel_settings_rounded,
              color: AppTheme.primary,
            ),
            MetricCard(
              label: 'Bác sĩ',
              value: '${_summary['doctor'] ?? 0}',
              icon: Icons.medical_services_rounded,
              color: AppTheme.teal,
            ),
            MetricCard(
              label: 'Nhân sự',
              value: '${_summary['staff'] ?? 0}',
              icon: Icons.badge_rounded,
              color: AppTheme.warning,
            ),
            MetricCard(
              label: 'Bệnh nhân',
              value: '${_summary['patient'] ?? 0}',
              icon: Icons.personal_injury_rounded,
              color: const Color(0xFF7C3AED),
            ),
          ],
        ),
        const SizedBox(height: 22),
        SearchField(
          controller: _searchController,
          hint: 'Tìm theo email, họ tên hoặc vai trò...',
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 14),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else if (visible.isEmpty)
          const EmptyState(
            title: 'Không tìm thấy tài khoản',
            message: 'Thử thay đổi từ khóa hoặc tải lại dữ liệu.',
            icon: Icons.person_search_rounded,
          )
        else
          ...visible.map((account) {
            final name = firstText(account, const ['hoTen', 'fullName', 'email', 'username']);
            final email = firstText(account, const ['email', 'username']);
            final role = firstText(account, const ['primaryRole', 'maNhom', 'role']);
            final enabled = account['enabled'] != false;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DataListTile(
                title: name,
                subtitle: '$email · $role',
                icon: Icons.account_circle_rounded,
                status: enabled ? 'ACTIVE' : 'DISABLED',
                trailing: PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'role') _changeRole(account);
                    if (value == 'disable') _disable(account);
                    if (value == 'details') {
                      showDataDetails(context, title: name, data: account);
                    }
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem(value: 'details', child: Text('Xem chi tiết')),
                    PopupMenuItem(value: 'role', child: Text('Đổi vai trò')),
                    PopupMenuItem(value: 'disable', child: Text('Vô hiệu hóa')),
                  ],
                ),
                onTap: () => showDataDetails(context, title: name, data: account),
              ),
            );
          }),
      ],
    );
  }
}
