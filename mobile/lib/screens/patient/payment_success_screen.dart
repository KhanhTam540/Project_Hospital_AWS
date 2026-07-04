import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';

class PaymentSuccessScreen extends StatelessWidget {
  const PaymentSuccessScreen({super.key, required this.referenceId});

  final String referenceId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 48),
            AppCard(
              child: Column(
                children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: AppTheme.teal.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: AppTheme.teal,
                      size: 52,
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'Thanh toán thành công',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Mã tham chiếu $referenceId đã được xác nhận trong chế độ demo.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 22),
                  _SuccessRow(
                    icon: Icons.event_available_rounded,
                    title: 'Lịch hẹn đã xác nhận',
                    subtitle: 'Bạn có thể xem lại trong mục Lịch hẹn.',
                  ),
                  const SizedBox(height: 10),
                  _SuccessRow(
                    icon: Icons.receipt_long_rounded,
                    title: 'Hóa đơn đã ghi nhận',
                    subtitle: 'Thông tin thanh toán được lưu trong lịch sử.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: () => context.go('/patient/lich'),
              icon: const Icon(Icons.event_note_rounded),
              label: const Text('Xem lịch hẹn'),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => context.go('/patient'),
              icon: const Icon(Icons.home_rounded),
              label: const Text('Về trang chủ'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SuccessRow extends StatelessWidget {
  const _SuccessRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: context.isDark
            ? const Color(0xFF0B1622)
            : const Color(0xFFF8FBFD),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.teal),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 2),
                Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
