import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';

class HoSoBenhAnDetailScreen extends StatefulWidget {
  const HoSoBenhAnDetailScreen({super.key, required this.maHSBA});

  final String maHSBA;

  @override
  State<HoSoBenhAnDetailScreen> createState() => _HoSoBenhAnDetailScreenState();
}

class _HoSoBenhAnDetailScreenState extends State<HoSoBenhAnDetailScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _record;
  List<Map<String, dynamic>> _examinations = const [];
  List<Map<String, dynamic>> _prescriptions = const [];
  List<Map<String, dynamic>> _documents = const [];

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
        _error = 'Không tìm thấy mã bệnh nhân.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final responses = await Future.wait([
        _api.get('/patients/$patientId/records'),
        _api.get('/patients/$patientId/examinations'),
        _api.get('/patients/$patientId/prescriptions'),
        _api.get('/patients/$patientId/documents'),
      ]);

      final records = _items(_api.dataOf(responses[0]));
      final examinations = _items(_api.dataOf(responses[1]));
      final prescriptions = _items(_api.dataOf(responses[2]));
      final documents = _items(_api.dataOf(responses[3]));
      final record = records.cast<Map<String, dynamic>?>().firstWhere(
        (item) => item?['recordId']?.toString() == widget.maHSBA,
        orElse: () => null,
      );

      if (record == null) {
        throw StateError('Không tìm thấy hồ sơ ${widget.maHSBA}.');
      }

      if (!mounted) return;
      setState(() {
        _record = record;
        _examinations = examinations.where((item) {
          final recordId = item['recordId']?.toString();
          return recordId == null ||
              recordId.isEmpty ||
              recordId == widget.maHSBA;
        }).toList();
        _prescriptions = prescriptions
            .where((item) => item['recordId']?.toString() == widget.maHSBA)
            .toList();
        _documents = documents;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải chi tiết hồ sơ: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<Map<String, dynamic>> _items(dynamic value) {
    final raw = value is Map ? value['items'] : null;
    if (raw is! List) {
      throw const FormatException('API không trả về items.');
    }
    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chi tiết hồ sơ'),
        leading: IconButton(
          onPressed: () => context.go('/patient/hoso'),
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
            else ...[
              _buildRecordCard(),
              const SizedBox(height: 18),
              _buildExaminations(),
              const SizedBox(height: 18),
              _buildPrescriptions(),
              const SizedBox(height: 18),
              _buildDocuments(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRecordCard() {
    final record = _record!;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Thông tin bệnh án',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 14),
          _InfoRow(label: 'Mã hồ sơ', value: widget.maHSBA),
          _InfoRow(label: 'Ngày lập', value: _date(record['createdAt'])),
          _InfoRow(label: 'Triệu chứng', value: _text(record['symptoms'])),
          _InfoRow(label: 'Chẩn đoán', value: _text(record['diagnosis'])),
          _InfoRow(label: 'Điều trị', value: _text(record['treatment'])),
          _InfoRow(label: 'Tiền sử', value: _text(record['medicalHistory'])),
          _InfoRow(label: 'Ghi chú', value: _text(record['note'])),
        ],
      ),
    );
  }

  Widget _buildExaminations() {
    return _ListSection(
      title: 'Phiếu khám và sinh hiệu',
      emptyMessage: 'Chưa có phiếu khám.',
      children: _examinations.map((item) {
        final vitals = item['vitals'] is Map
            ? Map<String, dynamic>.from(item['vitals'] as Map)
            : <String, dynamic>{};
        return _SubCard(
          title: _date(item['createdAt']),
          lines: [
            if (_text(item['symptoms']).isNotEmpty)
              'Triệu chứng: ${_text(item['symptoms'])}',
            if (_text(item['diagnosis']).isNotEmpty)
              'Chẩn đoán: ${_text(item['diagnosis'])}',
            if (_text(item['treatment']).isNotEmpty)
              'Điều trị: ${_text(item['treatment'])}',
            if (_text(item['advice']).isNotEmpty)
              'Lời dặn: ${_text(item['advice'])}',
            if (vitals.isNotEmpty) 'Sinh hiệu: ${_vitals(vitals)}',
          ],
        );
      }).toList(),
    );
  }

  Widget _buildPrescriptions() {
    return _ListSection(
      title: 'Đơn thuốc',
      emptyMessage: 'Chưa có đơn thuốc cho hồ sơ này.',
      children: _prescriptions.map((item) {
        final medicines = item['medicineItems'] is List
            ? item['medicineItems'] as List
            : const [];
        final lines = medicines.whereType<Map>().map((medicine) {
          final name =
              medicine['medicineName'] ?? medicine['medicineId'] ?? 'Thuốc';
          final quantity = medicine['quantity'] ?? '';
          final dosage = medicine['dosage'] ?? '';
          final frequency = medicine['frequency'] ?? '';
          return '$name - SL: $quantity; $dosage; $frequency';
        }).toList();
        if (_text(item['generalInstructions']).isNotEmpty) {
          lines.add('Hướng dẫn: ${_text(item['generalInstructions'])}');
        }
        return _SubCard(title: _date(item['createdAt']), lines: lines);
      }).toList(),
    );
  }

  Widget _buildDocuments() {
    return _ListSection(
      title: 'Tài liệu y tế',
      emptyMessage: 'Chưa có tài liệu y tế.',
      children: _documents.map((item) {
        return _SubCard(
          title: _text(item['fileName']).isEmpty
              ? 'Tài liệu y tế'
              : _text(item['fileName']),
          lines: [
            'Trạng thái: ${_text(item['status'])}',
            if (_text(item['contentType']).isNotEmpty)
              'Loại: ${_text(item['contentType'])}',
          ],
        );
      }).toList(),
    );
  }

  String _text(dynamic value) => value?.toString().trim() ?? '';

  String _date(dynamic value) {
    final parsed = DateTime.tryParse(_text(value));
    return parsed == null
        ? 'Chưa cập nhật'
        : DateFormat('dd/MM/yyyy HH:mm').format(parsed.toLocal());
  }

  String _vitals(Map<String, dynamic> vitals) {
    final values = <String>[];
    if (vitals['temperature'] != null) {
      values.add('${vitals['temperature']}°C');
    }
    if (vitals['heartRate'] != null) {
      values.add('Mạch ${vitals['heartRate']}');
    }
    if (vitals['systolicBloodPressure'] != null ||
        vitals['diastolicBloodPressure'] != null) {
      values.add(
        'HA ${vitals['systolicBloodPressure'] ?? '-'}/'
        '${vitals['diastolicBloodPressure'] ?? '-'}',
      );
    }
    if (vitals['oxygenSaturation'] != null) {
      values.add('SpO₂ ${vitals['oxygenSaturation']}%');
    }
    return values.isEmpty ? 'Chưa cập nhật' : values.join(', ');
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: Theme.of(context).textTheme.bodyMedium),
          ),
          Expanded(child: Text(value.isEmpty ? 'Chưa cập nhật' : value)),
        ],
      ),
    );
  }
}

class _ListSection extends StatelessWidget {
  const _ListSection({
    required this.title,
    required this.emptyMessage,
    required this.children,
  });

  final String title;
  final String emptyMessage;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (children.isEmpty) Text(emptyMessage) else ...children,
        ],
      ),
    );
  }
}

class _SubCard extends StatelessWidget {
  const _SubCard({required this.title, required this.lines});

  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: context.appBorder),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          if (lines.isEmpty)
            const Text('Chưa có thông tin chi tiết.')
          else
            ...lines.map(
              (line) => Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(line),
              ),
            ),
        ],
      ),
    );
  }
}
