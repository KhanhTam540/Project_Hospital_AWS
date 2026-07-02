import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  final HospitalApiService _service = HospitalApiService();
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _invoices = const [];
  Map<String, dynamic> _statistics = const {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final values = await Future.wait<Object>([
        _service.invoices(),
        _service.invoiceStatistics(),
      ]);
      if (!mounted) return;
      setState(() {
        _invoices = values[0] as List<Map<String, dynamic>>;
        _statistics = values[1] as Map<String, dynamic>;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _stat(List<String> keys, {String fallback = '0'}) {
    return firstText(_statistics, keys, fallback: fallback);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final ownLabel = auth.role == 'BENHNHAN' ? 'Hóa đơn của tôi' : 'Quản lý hóa đơn';

    return HospitalPage(
      onRefresh: _load,
      children: [
        PageHeader(
          title: ownLabel,
          subtitle:
              'Giao diện bám đúng API hóa đơn hiện có. Backend hiện chỉ cung cấp dữ liệu đọc và thống kê.',
          icon: Icons.receipt_long_rounded,
          badge: const EndpointBadge(method: 'GET', path: '/hoadon'),
          actions: [
            OutlinedButton.icon(
              onPressed: _loading ? null : _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Làm mới'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        ResponsiveGrid(
          children: [
            MetricCard(
              label: 'Tổng hóa đơn',
              value: _stat(const ['tongSo', 'totalCount'], fallback: '${_invoices.length}'),
              icon: Icons.receipt_rounded,
            ),
            MetricCard(
              label: 'Đã thanh toán',
              value: _stat(const ['daThanhToan', 'paidCount']),
              icon: Icons.verified_rounded,
              color: Colors.green,
            ),
            MetricCard(
              label: 'Chưa thanh toán',
              value: _stat(const ['chuaThanhToan', 'unpaidCount']),
              icon: Icons.pending_actions_rounded,
              color: Colors.orange,
            ),
            MetricCard(
              label: 'Tổng giá trị',
              value: _stat(const ['tongTien', 'totalAmount']),
              icon: Icons.payments_rounded,
              color: Colors.indigo,
            ),
          ],
        ),
        const SizedBox(height: 18),
        HospitalCard(
          backgroundColor: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.42),
          borderColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.22),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline_rounded),
              SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Backend hiện chưa có API tạo giao dịch VNPay/MoMo hoặc cập nhật trạng thái thanh toán. '
                  'Vì vậy giao diện chỉ hiển thị dữ liệu thật từ GET /hoadon và GET /hoadon/thongke, '
                  'không tạo nút thanh toán giả.',
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const SectionTitle(title: 'Danh sách hóa đơn'),
        const SizedBox(height: 12),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else if (_invoices.isEmpty)
          const EmptyState(
            title: 'Chưa có hóa đơn',
            message:
                'API backend hiện trả danh sách rỗng. Giao diện đã sẵn sàng hiển thị khi backend có dữ liệu.',
            icon: Icons.receipt_long_outlined,
          )
        else
          ..._invoices.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DataListTile(
                title: firstText(
                  item,
                  const ['maHD', 'invoiceId', 'noiDung'],
                  fallback: 'Hóa đơn',
                ),
                subtitle: firstText(
                  item,
                  const ['ngayLap', 'createdAt', 'tongTien', 'totalAmount'],
                  fallback: 'Nhấn để xem chi tiết',
                ),
                status: firstText(
                  item,
                  const ['trangThai', 'status'],
                  fallback: '',
                ),
                icon: Icons.receipt_rounded,
                onTap: () => showDataDetails(
                  context,
                  title: firstText(
                    item,
                    const ['maHD', 'invoiceId'],
                    fallback: 'Chi tiết hóa đơn',
                  ),
                  data: item,
                  labels: const {
                    'maHD': 'Mã hóa đơn',
                    'invoiceId': 'Mã hóa đơn',
                    'maBN': 'Mã bệnh nhân',
                    'patientId': 'Mã bệnh nhân',
                    'ngayLap': 'Ngày lập',
                    'createdAt': 'Ngày lập',
                    'tongTien': 'Tổng tiền',
                    'totalAmount': 'Tổng tiền',
                    'trangThai': 'Trạng thái',
                    'status': 'Trạng thái',
                    'noiDung': 'Nội dung',
                  },
                ),
              ),
            ),
          ),
      ],
    );
  }
}
