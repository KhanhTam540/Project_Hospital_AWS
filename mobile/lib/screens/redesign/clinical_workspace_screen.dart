import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/hospital_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/hospital_ui.dart';

class ClinicalWorkspaceScreen extends StatefulWidget {
  const ClinicalWorkspaceScreen({super.key});

  @override
  State<ClinicalWorkspaceScreen> createState() =>
      _ClinicalWorkspaceScreenState();
}

class _ClinicalWorkspaceScreenState extends State<ClinicalWorkspaceScreen> {
  final HospitalApiService _service = HospitalApiService();
  bool _loading = true;
  String? _error;
  String? _patientId;
  List<Map<String, dynamic>> _patients = const [];
  List<Map<String, dynamic>> _records = const [];
  List<Map<String, dynamic>> _examinations = const [];
  List<Map<String, dynamic>> _prescriptions = const [];
  List<Map<String, dynamic>> _documents = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initialize());
  }

  Future<void> _initialize() async {
    final auth = context.read<AuthProvider>();
    if (auth.role == 'BENHNHAN') {
      _patientId = auth.maBN;
    } else {
      try {
        _patients = await _service.patients();
        if (_patients.isNotEmpty) {
          _patientId = firstText(_patients.first, const ['maBN', 'patientId']);
        }
      } catch (_) {
        _patients = const [];
      }
    }
    await _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    if ((_patientId ?? '').isEmpty) {
      setState(() {
        _loading = false;
        _error = null;
        _records = const [];
        _examinations = const [];
        _prescriptions = const [];
        _documents = const [];
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final id = _patientId!;
      final results = await Future.wait([
        _service.records(id),
        _service.examinations(id),
        _service.prescriptions(id),
        _service.documents(id),
      ]);
      if (!mounted) return;
      setState(() {
        _records = results[0];
        _examinations = results[1];
        _prescriptions = results[2];
        _documents = results[3];
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isDoctor = auth.role == 'BACSI';
    final isStaff = auth.role == 'NHANSU';
    final canUpload = auth.role == 'ADMIN' || isDoctor || isStaff;

    return HospitalPage(
      onRefresh: _load,
      children: [
        PageHeader(
          title: 'Hồ sơ lâm sàng',
          subtitle:
              'Bệnh án, phiếu khám, đơn thuốc và tài liệu y tế theo bệnh nhân.',
          icon: Icons.cleaning_services_outlined,
          badge: const EndpointBadge(
            method: 'GET/POST',
            path: '/patients/{patientId}/...',
          ),
          actions: [
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Làm mới'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        if (auth.role != 'BENHNHAN')
          HospitalCard(
            child: DropdownButtonFormField<String>(
              initialValue: _patientId,
              decoration: const InputDecoration(
                labelText: 'Chọn bệnh nhân cần thao tác',
                prefixIcon: Icon(Icons.personal_injury_rounded),
              ),
              items: _patients.map((patient) {
                final id = firstText(patient, const ['maBN', 'patientId']);
                final name = firstText(patient, const ['hoTen', 'fullName']);
                return DropdownMenuItem(value: id, child: Text('$name · $id'));
              }).toList(),
              onChanged: (value) {
                setState(() => _patientId = value);
                _load();
              },
            ),
          ),
        if (auth.role != 'BENHNHAN') const SizedBox(height: 16),
        if ((_patientId ?? '').isEmpty)
          const EmptyState(
            title: 'Chưa xác định bệnh nhân',
            message:
                'Tài khoản chưa được liên kết với hồ sơ bệnh nhân hoặc danh sách bệnh nhân đang trống.',
            icon: Icons.person_off_rounded,
          )
        else if (_loading)
          const LoadingState(label: 'Đang tải hồ sơ lâm sàng...')
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else ...[
          ResponsiveGrid(
            children: [
              MetricCard(
                label: 'Bệnh án',
                value: '${_records.length}',
                icon: Icons.folder_shared_rounded,
                color: AppTheme.primary,
              ),
              MetricCard(
                label: 'Phiếu khám',
                value: '${_examinations.length}',
                icon: Icons.monitor_heart_rounded,
                color: AppTheme.teal,
              ),
              MetricCard(
                label: 'Đơn thuốc',
                value: '${_prescriptions.length}',
                icon: Icons.medication_rounded,
                color: const Color(0xFF7C3AED),
              ),
              MetricCard(
                label: 'Tài liệu',
                value: '${_documents.length}',
                icon: Icons.folder_copy_rounded,
                color: AppTheme.warning,
              ),
            ],
          ),
          const SizedBox(height: 22),
          _ClinicalSection(
            title: 'Hồ sơ bệnh án',
            subtitle: 'Chẩn đoán, triệu chứng và hướng điều trị',
            icon: Icons.folder_shared_rounded,
            endpoint: '/patients/$_patientId/records',
            items: _records,
            primaryKeys: const ['diagnosis', 'chuanDoan', 'recordId', 'maHSBA'],
            secondaryKeys: const [
              'symptoms',
              'trieuChung',
              'createdAt',
              'ngayLap',
            ],
            emptyText: 'Chưa có hồ sơ bệnh án.',
            onCreate: isDoctor ? () => _showRecordForm(_patientId!) : null,
          ),
          const SizedBox(height: 16),
          _ClinicalSection(
            title: 'Phiếu khám và sinh hiệu',
            subtitle: 'Nhiệt độ, huyết áp, nhịp tim và kết quả khám',
            icon: Icons.monitor_heart_rounded,
            endpoint: '/patients/$_patientId/examinations',
            items: _examinations,
            primaryKeys: const [
              'diagnosis',
              'chuanDoan',
              'examinationId',
              'maPK',
            ],
            secondaryKeys: const [
              'symptoms',
              'trieuChung',
              'createdAt',
              'ngayKham',
            ],
            emptyText: 'Chưa có phiếu khám.',
            onCreate: isDoctor || isStaff
                ? () => _showExaminationForm(_patientId!)
                : null,
          ),
          const SizedBox(height: 16),
          _ClinicalSection(
            title: 'Đơn thuốc',
            subtitle: 'Thuốc, liều dùng và hướng dẫn sử dụng',
            icon: Icons.medication_rounded,
            endpoint: '/patients/$_patientId/prescriptions',
            items: _prescriptions,
            primaryKeys: const [
              'prescriptionId',
              'maDT',
              'generalInstructions',
              'loiDan',
            ],
            secondaryKeys: const ['createdAt', 'ngayKeDon', 'doctorId', 'maBS'],
            emptyText: 'Chưa có đơn thuốc.',
            onCreate: isDoctor
                ? () => _showPrescriptionForm(_patientId!)
                : null,
          ),
          const SizedBox(height: 16),
          _DocumentSection(
            patientId: _patientId!,
            documents: _documents,
            canUpload: canUpload,
            onChanged: _load,
          ),
        ],
      ],
    );
  }

  Future<void> _showRecordForm(String patientId) async {
    final symptoms = TextEditingController();
    final diagnosis = TextEditingController();
    final treatment = TextEditingController();
    final history = TextEditingController();
    final note = TextEditingController();
    final saved = await _showClinicalForm(
      title: 'Tạo hồ sơ bệnh án',
      fields: [
        _FormFieldSpec('Triệu chứng', symptoms, 2),
        _FormFieldSpec('Chẩn đoán', diagnosis, 2),
        _FormFieldSpec('Điều trị', treatment, 2),
        _FormFieldSpec('Tiền sử bệnh', history, 2),
        _FormFieldSpec('Ghi chú', note, 2),
      ],
      onSave: () => _service.createRecord(patientId, {
        'symptoms': symptoms.text.trim(),
        'diagnosis': diagnosis.text.trim(),
        'treatment': treatment.text.trim(),
        'medicalHistory': history.text.trim(),
        'note': note.text.trim(),
      }),
    );
    for (final controller in [symptoms, diagnosis, treatment, history, note]) {
      controller.dispose();
    }
    if (saved) await _load();
  }

  Future<void> _showExaminationForm(String patientId) async {
    final symptoms = TextEditingController();
    final diagnosis = TextEditingController();
    final treatment = TextEditingController();
    final temperature = TextEditingController(text: '36.8');
    final heartRate = TextEditingController(text: '78');
    final systolic = TextEditingController(text: '115');
    final diastolic = TextEditingController(text: '75');
    final oxygen = TextEditingController(text: '99');
    final saved = await _showClinicalForm(
      title: 'Ghi nhận phiếu khám',
      fields: [
        _FormFieldSpec('Triệu chứng', symptoms, 2),
        _FormFieldSpec('Chẩn đoán (bác sĩ)', diagnosis, 2),
        _FormFieldSpec('Điều trị (bác sĩ)', treatment, 2),
        _FormFieldSpec('Nhiệt độ °C', temperature, 1, numeric: true),
        _FormFieldSpec('Nhịp tim', heartRate, 1, numeric: true),
        _FormFieldSpec('Huyết áp tâm thu', systolic, 1, numeric: true),
        _FormFieldSpec('Huyết áp tâm trương', diastolic, 1, numeric: true),
        _FormFieldSpec('SpO₂', oxygen, 1, numeric: true),
      ],
      onSave: () => _service.createExamination(patientId, {
        'symptoms': symptoms.text.trim(),
        'diagnosis': diagnosis.text.trim(),
        'treatment': treatment.text.trim(),
        'vitals': {
          'temperature': double.tryParse(temperature.text),
          'heartRate': int.tryParse(heartRate.text),
          'systolicBloodPressure': int.tryParse(systolic.text),
          'diastolicBloodPressure': int.tryParse(diastolic.text),
          'oxygenSaturation': int.tryParse(oxygen.text),
        },
      }),
    );
    for (final controller in [
      symptoms,
      diagnosis,
      treatment,
      temperature,
      heartRate,
      systolic,
      diastolic,
      oxygen,
    ]) {
      controller.dispose();
    }
    if (saved) await _load();
  }

  Future<void> _showPrescriptionForm(String patientId) async {
    final medicineId = TextEditingController();
    final medicineName = TextEditingController();
    final quantity = TextEditingController(text: '1');
    final dosage = TextEditingController();
    final frequency = TextEditingController();
    final days = TextEditingController(text: '3');
    final instructions = TextEditingController();
    final general = TextEditingController();
    final saved = await _showClinicalForm(
      title: 'Kê đơn thuốc',
      fields: [
        _FormFieldSpec('Mã thuốc', medicineId, 1),
        _FormFieldSpec('Tên thuốc', medicineName, 1),
        _FormFieldSpec('Số lượng', quantity, 1, numeric: true),
        _FormFieldSpec('Liều dùng', dosage, 1),
        _FormFieldSpec('Tần suất', frequency, 1),
        _FormFieldSpec('Số ngày', days, 1, numeric: true),
        _FormFieldSpec('Cách sử dụng', instructions, 2),
        _FormFieldSpec('Lời dặn chung', general, 2),
      ],
      onSave: () => _service.createPrescription(patientId, {
        'medicineItems': [
          {
            'medicineId': medicineId.text.trim(),
            'medicineName': medicineName.text.trim(),
            'quantity': int.tryParse(quantity.text) ?? 1,
            'dosage': dosage.text.trim(),
            'frequency': frequency.text.trim(),
            'durationDays': int.tryParse(days.text) ?? 1,
            'instructions': instructions.text.trim(),
          },
        ],
        'generalInstructions': general.text.trim(),
      }),
    );
    for (final controller in [
      medicineId,
      medicineName,
      quantity,
      dosage,
      frequency,
      days,
      instructions,
      general,
    ]) {
      controller.dispose();
    }
    if (saved) await _load();
  }

  Future<bool> _showClinicalForm({
    required String title,
    required List<_FormFieldSpec> fields,
    required Future<Map<String, dynamic>> Function() onSave,
  }) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) =>
          _ClinicalFormSheet(title: title, fields: fields, onSave: onSave),
    );
    return result == true;
  }
}

class _ClinicalSection extends StatelessWidget {
  const _ClinicalSection({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.endpoint,
    required this.items,
    required this.primaryKeys,
    required this.secondaryKeys,
    required this.emptyText,
    this.onCreate,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String endpoint;
  final List<Map<String, dynamic>> items;
  final List<String> primaryKeys;
  final List<String> secondaryKeys;
  final String emptyText;
  final VoidCallback? onCreate;

  @override
  Widget build(BuildContext context) {
    return HospitalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (onCreate != null)
                FilledButton.icon(
                  onPressed: onCreate,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Tạo mới'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          EndpointBadge(
            method: onCreate == null ? 'GET' : 'GET/POST',
            path: endpoint,
          ),
          const SizedBox(height: 14),
          if (items.isEmpty)
            Text(emptyText, style: Theme.of(context).textTheme.bodyMedium)
          else
            ...items.take(8).map((item) {
              final title = firstText(item, primaryKeys);
              final subtitle = firstText(
                item,
                secondaryKeys,
                fallback: 'Nhấn để xem chi tiết',
              );
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: DataListTile(
                  title: title,
                  subtitle: subtitle,
                  icon: icon,
                  status: firstText(item, const [
                    'status',
                    'trangThai',
                  ], fallback: ''),
                  onTap: () =>
                      showDataDetails(context, title: title, data: item),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _DocumentSection extends StatefulWidget {
  const _DocumentSection({
    required this.patientId,
    required this.documents,
    required this.canUpload,
    required this.onChanged,
  });

  final String patientId;
  final List<Map<String, dynamic>> documents;
  final bool canUpload;
  final Future<void> Function() onChanged;

  @override
  State<_DocumentSection> createState() => _DocumentSectionState();
}

class _DocumentSectionState extends State<_DocumentSection> {
  final HospitalApiService _service = HospitalApiService();
  bool _uploading = false;

  Future<void> _upload() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery);
    if (file == null) return;
    setState(() => _uploading = true);
    try {
      final bytes = await file.readAsBytes();
      final extension = file.name.toLowerCase();
      final contentType = extension.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';
      final request = await _service.createUploadUrl(
        patientId: widget.patientId,
        fileName: file.name,
        contentType: contentType,
        fileSize: bytes.length,
      );
      final uploadUrl = firstText(request, const ['uploadUrl']);
      final documentId = firstText(request, const ['documentId']);
      final rawHeaders = request['requiredHeaders'];
      final headers = rawHeaders is Map
          ? rawHeaders.map(
              (key, value) => MapEntry(key.toString(), value.toString()),
            )
          : <String, String>{'Content-Type': contentType};
      await _service.uploadToPresignedUrl(
        uploadUrl: uploadUrl,
        bytes: bytes,
        headers: headers,
      );
      await _service.completeUpload(documentId);
      await widget.onChanged();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tải tài liệu y tế thành công.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _copyDownload(Map<String, dynamic> document) async {
    final id = firstText(document, const ['documentId']);
    try {
      final result = await _service.downloadUrl(id);
      final url = firstText(result, const ['downloadUrl']);
      await Clipboard.setData(ClipboardData(text: url));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã sao chép liên kết tải tài liệu.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return HospitalCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.folder_copy_rounded,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tài liệu y tế',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    Text(
                      'Ảnh và tài liệu lưu trong S3 private',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (widget.canUpload)
                FilledButton.icon(
                  onPressed: _uploading ? null : _upload,
                  icon: _uploading
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.cloud_upload_rounded),
                  label: const Text('Tải lên'),
                ),
            ],
          ),
          const SizedBox(height: 12),
          const EndpointBadge(
            method: 'GET/POST',
            path: '/medical/upload-url · /documents',
          ),
          const SizedBox(height: 14),
          if (widget.documents.isEmpty)
            Text(
              'Chưa có tài liệu y tế.',
              style: Theme.of(context).textTheme.bodyMedium,
            )
          else
            ...widget.documents.map((document) {
              final name = firstText(document, const [
                'fileName',
                'documentId',
              ]);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: DataListTile(
                  title: name,
                  subtitle: firstText(document, const [
                    'createdAt',
                    'contentType',
                  ]),
                  icon: Icons.description_rounded,
                  status: firstText(document, const ['status'], fallback: ''),
                  trailing: IconButton(
                    tooltip: 'Sao chép liên kết tải',
                    onPressed: () => _copyDownload(document),
                    icon: const Icon(Icons.download_rounded),
                  ),
                  onTap: () =>
                      showDataDetails(context, title: name, data: document),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _FormFieldSpec {
  const _FormFieldSpec(
    this.label,
    this.controller,
    this.maxLines, {
    this.numeric = false,
  });
  final String label;
  final TextEditingController controller;
  final int maxLines;
  final bool numeric;
}

class _ClinicalFormSheet extends StatefulWidget {
  const _ClinicalFormSheet({
    required this.title,
    required this.fields,
    required this.onSave,
  });

  final String title;
  final List<_FormFieldSpec> fields;
  final Future<Map<String, dynamic>> Function() onSave;

  @override
  State<_ClinicalFormSheet> createState() => _ClinicalFormSheetState();
}

class _ClinicalFormSheetState extends State<_ClinicalFormSheet> {
  bool _saving = false;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await widget.onSave();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 46,
                height: 5,
                decoration: BoxDecoration(
                  color: Theme.of(context).dividerColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              widget.title,
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 18),
            for (final field in widget.fields) ...[
              TextField(
                controller: field.controller,
                maxLines: field.maxLines,
                keyboardType: field.numeric
                    ? TextInputType.number
                    : TextInputType.text,
                decoration: InputDecoration(labelText: field.label),
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_rounded),
                label: const Text('Lưu dữ liệu'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
