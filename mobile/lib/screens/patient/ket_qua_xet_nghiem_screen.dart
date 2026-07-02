import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class LabResultModel {
  const LabResultModel({
    required this.id,
    required this.testName,
    required this.categoryName,
    required this.performedAt,
    required this.resultText,
    required this.referenceRange,
    required this.unit,
    required this.staffName,
    required this.status,
  });

  final String id;
  final String testName;
  final String categoryName;
  final DateTime? performedAt;
  final String resultText;
  final String referenceRange;
  final String unit;
  final String staffName;
  final String status;

  factory LabResultModel.fromJson(Map<String, dynamic> json) {
    return LabResultModel(
      id: (json['maPhieuXN'] ?? json['labResultId'] ?? '').toString(),
      testName: (json['XetNghiem']?['tenXN'] ??
              json['testName'] ??
              'Xét nghiệm')
          .toString(),
      categoryName: (json['XetNghiem']?['LoaiXetNghiem']?['tenLoai'] ??
              json['categoryName'] ??
              'Tổng quát')
          .toString(),
      performedAt: DateTime.tryParse(
        (json['ngayThucHien'] ?? json['performedAt'] ?? '').toString(),
      ),
      resultText: (json['ketQua'] ?? json['resultText'] ?? '').toString(),
      referenceRange:
          (json['khoangThamChieu'] ?? json['referenceRange'] ?? '').toString(),
      unit: (json['donVi'] ?? json['unit'] ?? '').toString(),
      staffName: (json['NhanSuYTe']?['hoTen'] ??
              json['staffName'] ??
              'Kỹ thuật viên')
          .toString(),
      status: (json['trangThai'] ?? json['status'] ?? 'COMPLETED')
          .toString()
          .toUpperCase(),
    );
  }

  String get performedAtText => performedAt == null
      ? 'Chưa cập nhật'
      : DateFormat('dd/MM/yyyy HH:mm').format(performedAt!.toLocal());

  bool get hasResult => resultText.trim().isNotEmpty;
}

class KetQuaXetNghiemScreen extends StatefulWidget {
  const KetQuaXetNghiemScreen({super.key});

  @override
  State<KetQuaXetNghiemScreen> createState() =>
      _KetQuaXetNghiemScreenState();
}

class _KetQuaXetNghiemScreenState extends State<KetQuaXetNghiemScreen> {
  final ApiClient _api = ApiClient();

  bool _isLoading = true;
  String? _error;
  List<LabResultModel> _results = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get('/phieuxetnghiem');
      final data = _api.dataOf(response);
      if (data is! List) {
        throw const FormatException('API không trả về danh sách xét nghiệm.');
      }

      final results = data
          .map(
            (item) => LabResultModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .where((item) => item.id.isNotEmpty)
          .toList()
        ..sort((left, right) {
          final leftDate = left.performedAt ?? DateTime(1970);
          final rightDate = right.performedAt ?? DateTime(1970);
          return rightDate.compareTo(leftDate);
        });

      if (!mounted) return;
      setState(() => _results = results);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải kết quả xét nghiệm: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Kết quả xét nghiệm')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            AppCard(
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.purple.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.biotech_rounded,
                      color: Colors.purple,
                      size: 30,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Theo dõi kết quả',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Dữ liệu được bảo vệ bằng Cognito và chỉ trả về kết quả của tài khoản đang đăng nhập.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SectionHeader(
              title: 'Phiếu gần đây',
              actionLabel: 'Làm mới',
              onAction: _load,
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(30),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              AppCard(
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: AppTheme.danger),
                    const SizedBox(width: 12),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              )
            else if (_results.isEmpty)
              const AppCard(
                child: Column(
                  children: [
                    Icon(Icons.science_outlined, size: 44),
                    SizedBox(height: 10),
                    Text('Chưa có kết quả xét nghiệm.'),
                  ],
                ),
              )
            else
              ..._results.map(_buildResultCard),
          ],
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 2),
    );
  }

  Widget _buildResultCard(LabResultModel item) {
    final color = item.hasResult ? AppTheme.teal : Colors.orange;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: () => context.go('/patient/xetnghiem/${item.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.testName,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item.hasResult ? 'Đã có kết quả' : 'Đang xử lý',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(item.categoryName),
            const SizedBox(height: 10),
            Text('Thực hiện: ${item.performedAtText}'),
            const SizedBox(height: 4),
            Text('Nhân sự: ${item.staffName}'),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => context.go('/patient/xetnghiem/${item.id}'),
              icon: const Icon(Icons.description_outlined),
              label: const Text('Xem chi tiết'),
            ),
          ],
        ),
      ),
    );
  }
}
