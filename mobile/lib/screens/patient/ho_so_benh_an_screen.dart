import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class MedicalRecordSummary {
  const MedicalRecordSummary({
    required this.recordId,
    required this.diagnosis,
    required this.symptoms,
    required this.treatment,
    required this.note,
    required this.createdAt,
  });

  final String recordId;
  final String diagnosis;
  final String symptoms;
  final String treatment;
  final String note;
  final DateTime? createdAt;

  factory MedicalRecordSummary.fromJson(Map<String, dynamic> json) {
    return MedicalRecordSummary(
      recordId: (json['recordId'] ?? json['maHSBA'] ?? '').toString(),
      diagnosis: (json['diagnosis'] ?? json['chuanDoan'] ?? '').toString(),
      symptoms: (json['symptoms'] ?? json['trieuChung'] ?? '').toString(),
      treatment: (json['treatment'] ?? json['dieuTri'] ?? '').toString(),
      note: (json['note'] ?? json['ghiChu'] ?? '').toString(),
      createdAt: DateTime.tryParse(
        (json['createdAt'] ?? json['ngayLap'] ?? '').toString(),
      ),
    );
  }
}

class HoSoBenhAnScreen extends StatefulWidget {
  const HoSoBenhAnScreen({super.key});

  @override
  State<HoSoBenhAnScreen> createState() => _HoSoBenhAnScreenState();
}

class _HoSoBenhAnScreenState extends State<HoSoBenhAnScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  String? _error;
  List<MedicalRecordSummary> _records = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final patientId = context.read<AuthProvider>().maBN;
    if (patientId == null || patientId.isEmpty) {
      setState(() {
        _isLoading = false;
        _error = 'Tài khoản chưa được liên kết với hồ sơ bệnh nhân.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await _api.get('/patients/$patientId/records');
      final data = _api.dataOf(response);
      final items = data is Map ? data['items'] : null;
      if (items is! List) {
        throw const FormatException('API hồ sơ không trả về items.');
      }

      final records =
          items
              .map(
                (item) => MedicalRecordSummary.fromJson(
                  Map<String, dynamic>.from(item as Map),
                ),
              )
              .where((item) => item.recordId.isNotEmpty)
              .toList()
            ..sort((a, b) {
              final aDate =
                  a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
              final bDate =
                  b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
              return bDate.compareTo(aDate);
            });

      if (!mounted) return;
      setState(() => _records = records);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải hồ sơ bệnh án: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Hồ sơ sức khỏe')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            const AppCard(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.folder_shared_outlined, color: AppTheme.teal),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Dữ liệu được tải từ hồ sơ bệnh án đã lưu trên AWS. Chỉ tài khoản bệnh nhân tương ứng mới được phép xem.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SectionHeader(
              title: 'Lịch sử bệnh án',
              actionLabel: 'Làm mới',
              onAction: _load,
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(36),
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
            else if (_records.isEmpty)
              const AppCard(
                child: Row(
                  children: [
                    Icon(Icons.folder_off_outlined),
                    SizedBox(width: 12),
                    Expanded(child: Text('Chưa có hồ sơ bệnh án.')),
                  ],
                ),
              )
            else
              ..._records.map(_buildRecordCard),
          ],
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 2),
    );
  }

  Widget _buildRecordCard(MedicalRecordSummary record) {
    final dateText = record.createdAt == null
        ? 'Chưa xác định ngày'
        : DateFormat('dd/MM/yyyy HH:mm').format(record.createdAt!.toLocal());

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: () => context.go('/patient/hoso/${record.recordId}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.medical_information_outlined),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    record.diagnosis.isEmpty
                        ? 'Hồ sơ ${record.recordId}'
                        : record.diagnosis,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                const Icon(Icons.chevron_right),
              ],
            ),
            const SizedBox(height: 10),
            Text(dateText),
            if (record.symptoms.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Triệu chứng: ${record.symptoms}'),
            ],
            if (record.treatment.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Điều trị: ${record.treatment}'),
            ],
          ],
        ),
      ),
    );
  }
}
