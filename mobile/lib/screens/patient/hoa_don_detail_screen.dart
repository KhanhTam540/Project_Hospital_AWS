import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';

class HoaDonDetailScreen extends StatefulWidget {
  const HoaDonDetailScreen({super.key, required this.maHD});

  final String maHD;

  @override
  State<HoaDonDetailScreen> createState() => _HoaDonDetailScreenState();
}

class _HoaDonDetailScreenState extends State<HoaDonDetailScreen> {
  final _api = ApiClient();
  final _currency = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );
  Map<String, dynamic>? _invoice;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final maBN = context.read<AuthProvider>().maBN ?? 'BN001';
    final response = await _api.get('/hoadon/myhoadon/$maBN');
    final data = jsonDecode(response.body)['data'] as List;
    final invoice = data.cast<Map<String, dynamic>>().firstWhere(
      (item) =>
          item['maHD']?.toString() == widget.maHD ||
          item['maHoaDon']?.toString() == widget.maHD,
      orElse: () => data.isNotEmpty ? data.first : <String, dynamic>{},
    );

    if (!mounted) return;
    setState(() {
      _invoice = invoice;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final invoice = _invoice;

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết hóa đơn')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : invoice == null || invoice.isEmpty
          ? _buildMissing()
          : ListView(
              padding: const EdgeInsets.all(18),
              children: [
                _buildHeader(invoice),
                const SizedBox(height: 16),
                _buildLines(invoice),
                const SizedBox(height: 16),
                _buildActions(invoice),
              ],
            ),
    );
  }

  Widget _buildMissing() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: AppCard(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.receipt_long_outlined, size: 48),
              const SizedBox(height: 12),
              Text(
                'Không tìm thấy hóa đơn',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.go('/patient/hoadon'),
                child: const Text('Quay lại hóa đơn'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(Map<String, dynamic> invoice) {
    final status = invoice['trangThai']?.toString() ?? 'CHUA_THANH_TOAN';
    final paid = status == 'DA_THANH_TOAN';
    final amount =
        double.tryParse(
          (invoice['tongTien'] ?? invoice['soTien'] ?? 0).toString(),
        ) ??
        0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: (paid ? AppTheme.teal : Colors.orange).withValues(
                    alpha: 0.12,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(
                  paid ? Icons.check_circle_rounded : Icons.payments_outlined,
                  color: paid ? AppTheme.teal : Colors.orange,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.maHD,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      paid ? 'Đã thanh toán' : 'Chưa thanh toán',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            _currency.format(amount),
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ],
      ),
    );
  }

  Widget _buildLines(Map<String, dynamic> invoice) {
    final date = DateTime.tryParse(invoice['ngayLap']?.toString() ?? '');
    final amount =
        double.tryParse(
          (invoice['tongTien'] ?? invoice['soTien'] ?? 0).toString(),
        ) ??
        0;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Thông tin thanh toán',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          _Line(
            label: 'Nội dung',
            value: invoice['noiDung']?.toString() ?? 'Dịch vụ y tế',
          ),
          _Line(
            label: 'Ngày lập',
            value: date == null
                ? 'Chưa có ngày'
                : DateFormat('dd/MM/yyyy').format(date),
          ),
          _Line(
            label: 'Mã bệnh nhân',
            value: invoice['maBN']?.toString() ?? 'BN001',
          ),
          _Line(label: 'Số tiền', value: _currency.format(amount)),
        ],
      ),
    );
  }

  Widget _buildActions(Map<String, dynamic> invoice) {
    final paid = invoice['trangThai']?.toString() == 'DA_THANH_TOAN';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!paid)
          ElevatedButton.icon(
            onPressed: () => context.go('/patient/payment/qr/${widget.maHD}'),
            icon: const Icon(Icons.qr_code_rounded),
            label: const Text('Thanh toán QR'),
          ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => context.go('/patient/hoadon'),
          icon: const Icon(Icons.arrow_back_rounded),
          label: const Text('Quay lại hóa đơn'),
        ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
