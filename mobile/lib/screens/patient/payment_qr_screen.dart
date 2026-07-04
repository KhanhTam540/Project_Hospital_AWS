import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';

class PaymentQRScreen extends StatefulWidget {
  const PaymentQRScreen({super.key, required this.maLich});

  final String maLich;

  @override
  State<PaymentQRScreen> createState() => _PaymentQRScreenState();
}

class _PaymentQRScreenState extends State<PaymentQRScreen> {
  final _amount = 100000.0;
  bool _isProcessing = false;

  Future<void> _confirmPayment() async {
    setState(() => _isProcessing = true);
    await Future<void>.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    context.go('/patient/payment/success/${widget.maLich}');
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Thanh toán QR')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          AppCard(
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: Theme.of(
                      context,
                    ).colorScheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    Icons.qr_code_2_rounded,
                    color: Theme.of(context).colorScheme.primary,
                    size: 42,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Phí đặt chỗ',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  currency.format(_amount),
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  'Mã tham chiếu: ${widget.maLich}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              children: [
                Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    color: context.isDark
                        ? const Color(0xFF0B1622)
                        : const Color(0xFFF8FBFD),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: context.appBorder),
                  ),
                  child: CustomPaint(painter: _DemoQrPainter()),
                ),
                const SizedBox(height: 14),
                Text(
                  'Quét mã bằng ứng dụng ngân hàng hoặc bấm xác nhận để mô phỏng thanh toán thành công.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Thông tin chuyển khoản',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                const _PaymentInfo(label: 'Ngân hàng', value: 'Demo Bank'),
                const _PaymentInfo(
                  label: 'Người nhận',
                  value: 'Bệnh viện Demo',
                ),
                _PaymentInfo(
                  label: 'Nội dung',
                  value: 'DAT CHO ${widget.maLich}',
                ),
                _PaymentInfo(label: 'Số tiền', value: currency.format(_amount)),
              ],
            ),
          ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _isProcessing ? null : _confirmPayment,
            icon: _isProcessing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check_circle_outline_rounded),
            label: Text(
              _isProcessing ? 'Đang xác nhận...' : 'Xác nhận đã thanh toán',
            ),
          ),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: _isProcessing ? null : () => context.go('/patient/lich'),
            icon: const Icon(Icons.arrow_back_rounded),
            label: const Text('Quay lại lịch hẹn'),
          ),
        ],
      ),
    );
  }
}

class _PaymentInfo extends StatelessWidget {
  const _PaymentInfo({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(
            width: 98,
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _DemoQrPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = AppTheme.primary;
    final cell = size.width / 11;
    final pattern = <Offset>[
      const Offset(0, 0),
      const Offset(1, 0),
      const Offset(2, 0),
      const Offset(0, 1),
      const Offset(2, 1),
      const Offset(0, 2),
      const Offset(1, 2),
      const Offset(2, 2),
      const Offset(8, 0),
      const Offset(9, 0),
      const Offset(10, 0),
      const Offset(8, 1),
      const Offset(10, 1),
      const Offset(8, 2),
      const Offset(9, 2),
      const Offset(10, 2),
      const Offset(0, 8),
      const Offset(1, 8),
      const Offset(2, 8),
      const Offset(0, 9),
      const Offset(2, 9),
      const Offset(0, 10),
      const Offset(1, 10),
      const Offset(2, 10),
      const Offset(4, 4),
      const Offset(5, 4),
      const Offset(7, 4),
      const Offset(3, 5),
      const Offset(6, 5),
      const Offset(8, 5),
      const Offset(4, 6),
      const Offset(6, 6),
      const Offset(7, 7),
      const Offset(5, 8),
      const Offset(8, 8),
      const Offset(9, 9),
      const Offset(4, 10),
      const Offset(6, 10),
    ];

    for (final offset in pattern) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            offset.dx * cell,
            offset.dy * cell,
            cell * 0.82,
            cell * 0.82,
          ),
          Radius.circular(cell * 0.16),
        ),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
