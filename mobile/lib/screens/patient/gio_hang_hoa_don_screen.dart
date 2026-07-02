import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class HoaDon {
  const HoaDon({
    required this.maHD,
    required this.tongTien,
    required this.trangThai,
    required this.ngayLap,
    required this.noiDung,
  });

  final String maHD;
  final double tongTien;
  final String trangThai;
  final DateTime? ngayLap;
  final String noiDung;

  factory HoaDon.fromJson(Map<String, dynamic> json) => HoaDon(
    maHD: json['maHD']?.toString() ?? json['maHoaDon']?.toString() ?? 'Chưa có mã hóa đơn',
    tongTien:
        double.tryParse((json['tongTien'] ?? json['soTien'] ?? 0).toString()) ??
        0,
    trangThai: json['trangThai']?.toString() ?? 'CHUA_THANH_TOAN',
    ngayLap: DateTime.tryParse(json['ngayLap']?.toString() ?? ''),
    noiDung: json['noiDung']?.toString() ?? 'Dịch vụ y tế',
  );

  String get ngayText => ngayLap == null
      ? 'Chưa có ngày'
      : DateFormat('dd/MM/yyyy').format(ngayLap!);
}

class CartItem {
  const CartItem({required this.id, required this.title, required this.amount});

  final String id;
  final String title;
  final double amount;

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
    id:
        json['maCTGH']?.toString() ??
        json['maDichVu']?.toString() ??
        json['maHoaDon']?.toString() ??
        'Chưa có mã dịch vụ',
    title:
        json['noiDung']?.toString() ??
        '${json['loaiDichVu'] ?? 'Dịch vụ'} ${json['maDichVu'] ?? ''}',
    amount:
        double.tryParse(
          (json['thanhTien'] ?? json['soTien'] ?? 0).toString(),
        ) ??
        0,
  );
}

class GioHangHoaDonScreen extends StatefulWidget {
  const GioHangHoaDonScreen({super.key});

  @override
  State<GioHangHoaDonScreen> createState() => _GioHangHoaDonScreenState();
}

class _GioHangHoaDonScreenState extends State<GioHangHoaDonScreen> {
  final _api = ApiClient();
  final _currency = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  bool _isLoading = true;
  List<CartItem> _cartItems = [];
  List<HoaDon> _invoices = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final maBN = context.read<AuthProvider>().maBN;

    if (maBN == null || maBN.trim().isEmpty) {
      _showSnack('Không xác định được mã bệnh nhân từ /api/me.');
      if (mounted) {
        setState(() => _isLoading = false);
      }
      return;
    }

    try {
      // Backend hiện hỗ trợ GET /api/hoadon. Các route giohang/myhoadon
      // thuộc giao diện cũ và không tồn tại trong HospitalDevStack.
      final response = await _api.get('/hoadon');
      final rawInvoices = _api.listDataOf(response);
      final filteredInvoices = rawInvoices.where((item) {
        final patientId = (item['maBN'] ?? item['patientId'])?.toString();
        return patientId == null || patientId.isEmpty || patientId == maBN;
      }).toList();

      if (!mounted) return;
      setState(() {
        _cartItems = const [];
        _invoices = filteredInvoices.map(HoaDon.fromJson).toList();
      });
    } catch (e) {
      _showSnack('Không thể tải hóa đơn: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _confirmCart() {
    if (!mounted) return;
    _showSnack(
      'Backend hiện chưa triển khai tạo hóa đơn hoặc thanh toán trực tuyến.',
    );
  }

  void _showSnack(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.danger : AppTheme.teal,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalCart = _cartItems.fold<double>(
      0,
      (sum, item) => sum + item.amount,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Hóa đơn & thanh toán')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            _buildSummary(totalCart),
            const SizedBox(height: 18),
            SectionHeader(
              title: 'Dịch vụ chờ thanh toán',
              actionLabel: 'Làm mới',
              onAction: _load,
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else
              _buildCart(totalCart),
            const SizedBox(height: 22),
            SectionHeader(title: 'Lịch sử hóa đơn'),
            const SizedBox(height: 12),
            if (!_isLoading) _buildInvoices(),
          ],
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 0),
    );
  }

  Widget _buildSummary(double totalCart) {
    final unpaid = _invoices
        .where((item) => item.trangThai != 'DA_THANH_TOAN')
        .fold<double>(totalCart, (sum, item) => sum + item.tongTien);

    return AppCard(
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.receipt_long_rounded, color: Colors.orange),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tổng cần thanh toán',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  _currency.format(unpaid),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCart(double totalCart) {
    if (_cartItems.isEmpty) {
      return AppCard(
        child: Column(
          children: [
            Icon(
              Icons.shopping_cart_outlined,
              color: context.appMuted,
              size: 42,
            ),
            const SizedBox(height: 10),
            Text(
              'Không có dịch vụ chờ thanh toán',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              'Các khoản phí mới sẽ xuất hiện tại đây.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      );
    }

    return AppCard(
      child: Column(
        children: [
          ..._cartItems.map(
            (item) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.medical_information_outlined),
              title: Text(item.title),
              subtitle: Text(item.id),
              trailing: Text(
                _currency.format(item.amount),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          const Divider(),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Tạm tính',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                _currency.format(totalCart),
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ],
          ),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            onPressed: _confirmCart,
            icon: const Icon(Icons.receipt_rounded),
            label: const Text('Tạo hóa đơn'),
          ),
        ],
      ),
    );
  }

  Widget _buildInvoices() {
    if (_invoices.isEmpty) {
      return AppCard(
        child: Text(
          'Chưa có hóa đơn nào.',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
      );
    }

    return Column(
      children: _invoices.map((invoice) {
        final paid = invoice.trangThai == 'DA_THANH_TOAN';
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: AppCard(
            onTap: () => context.go('/patient/hoadon/${invoice.maHD}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        invoice.maHD,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    _InvoiceChip(
                      label: paid ? 'Đã thanh toán' : 'Chưa thanh toán',
                      color: paid ? AppTheme.teal : Colors.orange,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  invoice.noiDung,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        invoice.ngayText,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    Text(
                      _currency.format(invoice.tongTien),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () =>
                            context.go('/patient/hoadon/${invoice.maHD}'),
                        icon: const Icon(Icons.visibility_outlined),
                        label: const Text('Chi tiết'),
                      ),
                    ),
                    if (!paid) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () =>
                              context.go('/patient/payment/qr/${invoice.maHD}'),
                          icon: const Icon(Icons.qr_code_rounded),
                          label: const Text('QR'),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _InvoiceChip extends StatelessWidget {
  const _InvoiceChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}
