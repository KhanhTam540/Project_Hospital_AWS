import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'ket_qua_xet_nghiem_screen.dart';

class KetQuaXetNghiemDetailScreen extends StatefulWidget {
  const KetQuaXetNghiemDetailScreen({super.key, required this.maPhieuXN});

  final String maPhieuXN;

  @override
  State<KetQuaXetNghiemDetailScreen> createState() =>
      _KetQuaXetNghiemDetailScreenState();
}

class _KetQuaXetNghiemDetailScreenState
    extends State<KetQuaXetNghiemDetailScreen> {
  final ApiClient _api = ApiClient();

  LabResultModel? _result;
  bool _isLoading = true;
  String? _error;

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
      final response = await _api.get('/phieuxetnghiem/${widget.maPhieuXN}');
      final data = _api.dataOf(response);
      if (data is! Map) {
        throw const FormatException('API không trả về phiếu xét nghiệm.');
      }

      if (!mounted) return;
      setState(
        () =>
            _result = LabResultModel.fromJson(Map<String, dynamic>.from(data)),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không tải được phiếu xét nghiệm: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết xét nghiệm'),
        leading: IconButton(
          onPressed: () => context.go('/patient/xetnghiem'),
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(42),
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
            else if (_result != null) ...[
              _buildHeader(_result!),
              const SizedBox(height: 16),
              _buildDetails(_result!),
              const SizedBox(height: 16),
              const AppCard(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.health_and_safety_outlined,
                      color: AppTheme.teal,
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Kết quả chỉ có ý nghĩa khi được bác sĩ hoặc nhân viên y tế giải thích trong bối cảnh lâm sàng.',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(LabResultModel result) {
    return AppCard(
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppTheme.teal.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.fact_check_rounded,
              color: AppTheme.teal,
              size: 30,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  result.testName,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(result.categoryName),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetails(LabResultModel result) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Thông tin phiếu',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          _DetailRow(label: 'Mã phiếu', value: result.id),
          _DetailRow(label: 'Ngày thực hiện', value: result.performedAtText),
          _DetailRow(label: 'Nhân sự', value: result.staffName),
          _DetailRow(label: 'Trạng thái', value: result.status),
          _DetailRow(
            label: 'Kết quả',
            value: result.resultText.isEmpty
                ? 'Đang chờ cập nhật'
                : '${result.resultText}${result.unit.isEmpty ? '' : ' ${result.unit}'}',
          ),
          if (result.referenceRange.isNotEmpty)
            _DetailRow(label: 'Tham chiếu', value: result.referenceRange),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label)),
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
