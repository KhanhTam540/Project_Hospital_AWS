import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';

class TiepNhanHome extends StatelessWidget {
  const TiepNhanHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tiếp nhận'),
        actions: [
          IconButton(
            tooltip: 'Đăng xuất',
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (context.mounted) context.go('/login');
            },
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          _buildHeader(context),
          const SizedBox(height: 18),
          _buildStats(context),
          const SizedBox(height: 22),
          SectionHeader(title: 'Thao tác nhanh'),
          const SizedBox(height: 12),
          _buildActions(context),
          const SizedBox(height: 22),
          SectionHeader(title: 'Danh sách tiếp nhận hôm nay'),
          const SizedBox(height: 12),
          ..._demoQueue.map((item) => _QueueCard(item: item)),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: Colors.amber.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.assignment_ind_rounded,
              color: Colors.amber,
              size: 32,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Xin chào, ${auth.tenDangNhap ?? 'Nhân viên tiếp nhận'}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  'Theo dõi lượt khám, xác nhận thông tin và hướng dẫn bệnh nhân.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStats(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.45,
      children: const [
        _StatCard(
          icon: Icons.people_alt_outlined,
          value: '18',
          label: 'Bệnh nhân hôm nay',
          color: AppTheme.primary,
        ),
        _StatCard(
          icon: Icons.schedule_outlined,
          value: '7',
          label: 'Đang chờ',
          color: Colors.orange,
        ),
        _StatCard(
          icon: Icons.check_circle_outline,
          value: '11',
          label: 'Đã tiếp nhận',
          color: AppTheme.teal,
        ),
        _StatCard(
          icon: Icons.receipt_long_outlined,
          value: '4',
          label: 'Chờ thanh toán',
          color: Colors.purple,
        ),
      ],
    );
  }

  Widget _buildActions(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: AppIconTile(
            icon: Icons.person_add_alt_1_rounded,
            title: 'Đăng ký bệnh nhân',
            subtitle: 'Tạo hồ sơ tiếp nhận',
            color: AppTheme.teal,
            onTap: () => _showDemoSnack(context),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: AppIconTile(
            icon: Icons.event_note_rounded,
            title: 'Lịch khám',
            subtitle: 'Kiểm tra lượt hẹn',
            color: Colors.orange,
            onTap: () => _showDemoSnack(context),
          ),
        ),
      ],
    );
  }

  void _showDemoSnack(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Chức năng demo đã sẵn sàng để nối backend ở tuần sau.'),
        backgroundColor: AppTheme.teal,
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  final IconData icon;
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const Spacer(),
          Text(value, style: Theme.of(context).textTheme.headlineMedium),
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({required this.item});

  final Map<String, String> item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: AppTheme.primary.withValues(alpha: 0.12),
              child: Text(
                item['order']!,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item['name']!,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item['service']!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.teal.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                item['status']!,
                style: const TextStyle(
                  color: AppTheme.teal,
                  fontWeight: FontWeight.w800,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const _demoQueue = [
  {
    'order': '01',
    'name': 'Trần Gia Hân',
    'service': 'Khám tổng quát - BS. Nguyễn Minh An',
    'status': 'Đã xác nhận',
  },
  {
    'order': '02',
    'name': 'Lê Hoàng Nam',
    'service': 'Tái khám - Khoa Nội tổng hợp',
    'status': 'Chờ vào khám',
  },
  {
    'order': '03',
    'name': 'Nguyễn Minh Thư',
    'service': 'Xét nghiệm công thức máu',
    'status': 'Chờ thanh toán',
  },
];
