import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/hospital_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/hospital_ui.dart';

class AppointmentWorkspaceScreen extends StatefulWidget {
  const AppointmentWorkspaceScreen({super.key});

  @override
  State<AppointmentWorkspaceScreen> createState() =>
      _AppointmentWorkspaceScreenState();
}

class _AppointmentWorkspaceScreenState
    extends State<AppointmentWorkspaceScreen> {
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _searchController = TextEditingController();

  bool _loading = true;
  String? _error;
  String _query = '';
  List<Map<String, dynamic>> _appointments = const [];
  List<Map<String, dynamic>> _doctors = const [];
  List<Map<String, dynamic>> _departments = const [];
  List<Map<String, dynamic>> _patients = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final auth = context.read<AuthProvider>();
      final results = await Future.wait([
        _service.appointments(
          patientId: auth.role == 'BENHNHAN' ? auth.maBN : null,
          doctorId: auth.role == 'BACSI' ? auth.maBS : null,
        ),
        _service.doctors(),
        _service.departments(),
        if (auth.role == 'ADMIN' || auth.role == 'NHANSU')
          _service.patients()
        else
          Future.value(<Map<String, dynamic>>[]),
      ]);
      if (!mounted) return;
      setState(() {
        _appointments = results[0];
        _doctors = results[1];
        _departments = results[2];
        _patients = results[3];
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visible {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _appointments;
    return _appointments.where((item) {
      return item.values
          .map((value) => value.toString())
          .join(' ')
          .toLowerCase()
          .contains(query);
    }).toList();
  }

  Future<void> _createAppointment() async {
    final auth = context.read<AuthProvider>();
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _AppointmentFormSheet(
        auth: auth,
        doctors: _doctors,
        departments: _departments,
        patients: _patients,
      ),
    );
    if (created == true) await _load();
  }

  Future<void> _showAppointmentDetails(Map<String, dynamic> item) async {
    final id = firstText(item, const ['appointmentId', 'maLich', 'maLH']);
    Map<String, dynamic> detail = item;
    try {
      detail = await _service.appointment(id);
    } catch (_) {
      detail = item;
    }
    if (!mounted) return;
    await showDataDetails(context, title: 'Lịch khám $id', data: detail);
  }

  Future<void> _cancel(Map<String, dynamic> item) async {
    final id = firstText(item, const ['appointmentId', 'maLich', 'maLH']);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Hủy lịch khám?'),
        content: Text('Lịch $id sẽ được chuyển sang trạng thái đã hủy.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Giữ lịch'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.danger),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Hủy lịch'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await _service.cancelAppointment(id);
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã hủy lịch khám.')));
      await _load();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  bool _canCancel(Map<String, dynamic> item) {
    final status = firstText(item, const ['status', 'trangThai']).toUpperCase();
    return !const [
      'CANCELLED',
      'DA_HUY',
      'COMPLETED',
      'HOAN_THANH',
    ].contains(status);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final canCreate =
        auth.role == 'BENHNHAN' ||
        auth.role == 'ADMIN' ||
        auth.role == 'NHANSU';
    final visible = _visible;

    return HospitalPage(
      onRefresh: _load,
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: _createAppointment,
              icon: const Icon(Icons.add_rounded),
              label: const Text('Đặt lịch'),
            )
          : null,
      children: [
        PageHeader(
          title: 'Lịch khám',
          subtitle: _subtitleForRole(auth),
          icon: Icons.calendar_month_rounded,
          badge: const EndpointBadge(
            method: 'GET/POST/DELETE',
            path: '/lichkham',
          ),
          actions: [
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Làm mới'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        ResponsiveGrid(
          children: [
            MetricCard(
              label: 'Tổng lịch',
              value: '${_appointments.length}',
              icon: Icons.event_note_rounded,
            ),
            MetricCard(
              label: 'Đang chờ',
              value:
                  '${_countStatus(const ['PENDING', 'CHO_XAC_NHAN', 'DANG_CHO'])}',
              icon: Icons.hourglass_top_rounded,
              color: AppTheme.warning,
            ),
            MetricCard(
              label: 'Hoàn thành',
              value: '${_countStatus(const ['COMPLETED', 'HOAN_THANH'])}',
              icon: Icons.task_alt_rounded,
              color: AppTheme.success,
            ),
            MetricCard(
              label: 'Đã hủy',
              value: '${_countStatus(const ['CANCELLED', 'DA_HUY'])}',
              icon: Icons.event_busy_rounded,
              color: AppTheme.danger,
            ),
          ],
        ),
        const SizedBox(height: 22),
        SearchField(
          controller: _searchController,
          hint: 'Tìm theo mã lịch, bệnh nhân, bác sĩ hoặc ngày khám...',
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 14),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else if (visible.isEmpty)
          EmptyState(
            title: 'Chưa có lịch khám',
            message: canCreate
                ? 'Nhấn “Đặt lịch” để tạo lịch khám mới.'
                : 'Chưa có lịch khám được phân công.',
            icon: Icons.event_busy_rounded,
          )
        else
          ...visible.map((item) {
            final doctor = firstText(item, const [
              'tenBacSi',
              'BacSi',
              'maBS',
              'doctorId',
            ]);
            final patient = firstText(item, const [
              'tenBenhNhan',
              'BenhNhan',
              'maBN',
              'patientId',
            ]);
            final date = firstText(item, const [
              'ngayKham',
              'appointmentDate',
              'ngayHen',
            ]);
            final time = firstText(item, const [
              'gioKham',
              'appointmentTime',
              'maCa',
            ]);
            final status = firstText(item, const ['trangThai', 'status']);
            final queue = firstText(item, const [
              'soThuTu',
              'queueNumber',
            ], fallback: '—');
            final title = auth.role == 'BENHNHAN' ? doctor : patient;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DataListTile(
                title: title,
                subtitle: '$date · $time · STT $queue',
                icon: Icons.event_note_rounded,
                status: status,
                trailing: PopupMenuButton<String>(
                  onSelected: (value) {
                    if (value == 'details') {
                      _showAppointmentDetails(item);
                    } else if (value == 'cancel') {
                      _cancel(item);
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'details',
                      child: Text('Xem chi tiết'),
                    ),
                    if (_canCancel(item))
                      const PopupMenuItem(
                        value: 'cancel',
                        child: Text('Hủy lịch'),
                      ),
                  ],
                ),
                onTap: () => _showAppointmentDetails(item),
              ),
            );
          }),
      ],
    );
  }

  int _countStatus(List<String> values) {
    return _appointments.where((item) {
      final status = firstText(item, const [
        'status',
        'trangThai',
      ]).toUpperCase();
      return values.contains(status);
    }).length;
  }

  String _subtitleForRole(AuthProvider auth) {
    switch (auth.role) {
      case 'BENHNHAN':
        return 'Đặt lịch, theo dõi số thứ tự và quản lý lịch hẹn của bạn.';
      case 'BACSI':
        return 'Danh sách lịch hẹn được phân công cho bác sĩ.';
      default:
        return 'Theo dõi và điều phối lịch khám trong bệnh viện.';
    }
  }
}

class _AppointmentFormSheet extends StatefulWidget {
  const _AppointmentFormSheet({
    required this.auth,
    required this.doctors,
    required this.departments,
    required this.patients,
  });

  final AuthProvider auth;
  final List<Map<String, dynamic>> doctors;
  final List<Map<String, dynamic>> departments;
  final List<Map<String, dynamic>> patients;

  @override
  State<_AppointmentFormSheet> createState() => _AppointmentFormSheetState();
}

class _AppointmentFormSheetState extends State<_AppointmentFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _date = TextEditingController();
  final TextEditingController _time = TextEditingController(text: '08:00');
  final TextEditingController _note = TextEditingController();

  String? _patientId;
  String? _doctorId;
  String? _departmentId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _patientId = widget.auth.role == 'BENHNHAN' ? widget.auth.maBN : null;
    final tomorrow = DateTime.now().add(const Duration(days: 1));
    _date.text =
        '${tomorrow.year.toString().padLeft(4, '0')}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _date.dispose();
    _time.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);

    Map<String, dynamic>? doctor;
    for (final item in widget.doctors) {
      if (firstText(item, const ['maBS', 'doctorId']) == _doctorId) {
        doctor = item;
        break;
      }
    }
    final departmentId =
        _departmentId ??
        (doctor == null
            ? null
            : firstText(doctor, const [
                'maKhoa',
                'departmentId',
              ], fallback: ''));

    try {
      await _service.createAppointment({
        'maBN': _patientId,
        'patientId': _patientId,
        'maBS': _doctorId,
        'doctorId': _doctorId,
        'maKhoa': departmentId,
        'departmentId': departmentId,
        'ngayKham': _date.text.trim(),
        'appointmentDate': _date.text.trim(),
        'gioKham': _time.text.trim(),
        'appointmentTime': _time.text.trim(),
        'ghiChu': _note.text.trim(),
        'note': _note.text.trim(),
      });
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
    final selectPatient = widget.auth.role != 'BENHNHAN';
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 16,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
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
                'Đặt lịch khám',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 18),
              if (selectPatient) ...[
                DropdownButtonFormField<String>(
                  initialValue: _patientId,
                  decoration: const InputDecoration(
                    labelText: 'Bệnh nhân',
                    prefixIcon: Icon(Icons.personal_injury_rounded),
                  ),
                  items: widget.patients.map((item) {
                    final id = firstText(item, const ['maBN', 'patientId']);
                    final name = firstText(item, const ['hoTen', 'fullName']);
                    return DropdownMenuItem(
                      value: id,
                      child: Text('$name · $id'),
                    );
                  }).toList(),
                  onChanged: (value) => setState(() => _patientId = value),
                  validator: (value) =>
                      value == null || value.isEmpty ? 'Chọn bệnh nhân' : null,
                ),
                const SizedBox(height: 12),
              ],
              DropdownButtonFormField<String>(
                initialValue: _departmentId,
                decoration: const InputDecoration(
                  labelText: 'Khoa',
                  prefixIcon: Icon(Icons.apartment_rounded),
                ),
                items: widget.departments.map((item) {
                  final id = firstText(item, const ['maKhoa', 'departmentId']);
                  final name = firstText(item, const [
                    'tenKhoa',
                    'departmentName',
                  ]);
                  return DropdownMenuItem(value: id, child: Text(name));
                }).toList(),
                onChanged: (value) => setState(() {
                  _departmentId = value;
                  _doctorId = null;
                }),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _doctorId,
                decoration: const InputDecoration(
                  labelText: 'Bác sĩ',
                  prefixIcon: Icon(Icons.medical_services_rounded),
                ),
                items: widget.doctors
                    .where((item) {
                      if (_departmentId == null || _departmentId!.isEmpty)
                        return true;
                      return firstText(item, const [
                            'maKhoa',
                            'departmentId',
                          ], fallback: '') ==
                          _departmentId;
                    })
                    .map((item) {
                      final id = firstText(item, const ['maBS', 'doctorId']);
                      final name = firstText(item, const ['hoTen', 'fullName']);
                      final specialty = firstText(item, const [
                        'chuyenMon',
                        'specialty',
                      ], fallback: '');
                      return DropdownMenuItem(
                        value: id,
                        child: Text(
                          specialty.isEmpty ? name : '$name · $specialty',
                        ),
                      );
                    })
                    .toList(),
                onChanged: (value) => setState(() => _doctorId = value),
                validator: (value) =>
                    value == null || value.isEmpty ? 'Chọn bác sĩ' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _date,
                decoration: const InputDecoration(
                  labelText: 'Ngày khám (YYYY-MM-DD)',
                  prefixIcon: Icon(Icons.calendar_today_rounded),
                ),
                validator: (value) {
                  if (value == null ||
                      !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value.trim())) {
                    return 'Nhập đúng định dạng YYYY-MM-DD';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _time,
                decoration: const InputDecoration(
                  labelText: 'Giờ khám (HH:mm)',
                  prefixIcon: Icon(Icons.schedule_rounded),
                ),
                validator: (value) {
                  if (value == null ||
                      !RegExp(
                        r'^([01]\d|2[0-3]):[0-5]\d$',
                      ).hasMatch(value.trim())) {
                    return 'Nhập đúng định dạng HH:mm';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _note,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Lý do khám / ghi chú',
                  prefixIcon: Icon(Icons.notes_rounded),
                ),
              ),
              const SizedBox(height: 20),
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
                      : const Icon(Icons.check_circle_rounded),
                  label: const Text('Xác nhận đặt lịch'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
