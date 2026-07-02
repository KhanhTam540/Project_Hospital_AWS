import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class Khoa {
  const Khoa({
    required this.maKhoa,
    required this.tenKhoa,
  });

  final String maKhoa;
  final String tenKhoa;

  factory Khoa.fromJson(Map<String, dynamic> json) {
    return Khoa(
      maKhoa: (json['maKhoa'] ?? json['departmentId'] ?? '').toString(),
      tenKhoa: (json['tenKhoa'] ?? json['departmentName'] ?? 'Khoa khám')
          .toString(),
    );
  }
}

class BacSi {
  const BacSi({
    required this.maBS,
    required this.hoTen,
    required this.maKhoa,
    this.chuyenMon,
  });

  final String maBS;
  final String hoTen;
  final String maKhoa;
  final String? chuyenMon;

  factory BacSi.fromJson(Map<String, dynamic> json) {
    return BacSi(
      maBS: (json['maBS'] ?? json['doctorId'] ?? '').toString(),
      hoTen: (json['hoTen'] ?? json['fullName'] ?? 'Bác sĩ').toString(),
      maKhoa: (json['maKhoa'] ?? json['departmentId'] ?? '').toString(),
      chuyenMon: (json['chuyenMon'] ?? json['specialty'])?.toString(),
    );
  }
}

class LichHenModel {
  const LichHenModel({
    required this.maLich,
    required this.maBS,
    required this.tenBS,
    required this.ngayKham,
    required this.gioKham,
    required this.trangThai,
    required this.ghiChu,
    required this.phong,
    this.soThuTu,
  });

  final String maLich;
  final String maBS;
  final String tenBS;
  final DateTime ngayKham;
  final String gioKham;
  final String trangThai;
  final String ghiChu;
  final String phong;
  final int? soThuTu;

  factory LichHenModel.fromJson(Map<String, dynamic> json) {
    final dateText = (json['ngayKham'] ?? json['appointmentDate'] ?? '')
        .toString();
    final queueValue = json['soThuTu'] ?? json['queueNumber'];

    return LichHenModel(
      maLich: (json['maLich'] ?? json['appointmentId'] ?? '').toString(),
      maBS: (json['maBS'] ?? json['doctorId'] ?? '').toString(),
      tenBS: (json['BacSi']?['hoTen'] ?? json['doctorName'] ?? 'Bác sĩ')
          .toString(),
      ngayKham: DateTime.tryParse(dateText) ?? DateTime.now(),
      gioKham: (json['gioKham'] ?? json['appointmentTime'] ?? '').toString(),
      trangThai: (json['trangThai'] ?? json['status'] ?? 'PENDING')
          .toString()
          .toUpperCase(),
      ghiChu: (json['ghiChu'] ?? json['note'] ?? '').toString(),
      phong: (json['phong'] ?? json['roomId'] ?? '').toString(),
      soThuTu: queueValue is num
          ? queueValue.toInt()
          : int.tryParse(queueValue?.toString() ?? ''),
    );
  }

  String get ngayText => DateFormat('dd/MM/yyyy').format(ngayKham);

  bool get canCancel => !const {
        'CANCELLED',
        'COMPLETED',
        'DA_HUY',
        'HOAN_THANH',
      }.contains(trangThai);
}

class LichHenBNScreen extends StatefulWidget {
  const LichHenBNScreen({super.key});

  @override
  State<LichHenBNScreen> createState() => _LichHenBNScreenState();
}

class _LichHenBNScreenState extends State<LichHenBNScreen> {
  final ApiClient _api = ApiClient();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _reasonController = TextEditingController();

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;
  List<Khoa> _departments = const [];
  List<BacSi> _doctors = const [];
  List<LichHenModel> _appointments = const [];
  String? _selectedDepartmentId;
  String? _selectedDoctorId;
  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  String _selectedTime = '08:30';

  static const List<String> _timeOptions = [
    '07:30',
    '08:30',
    '09:30',
    '10:30',
    '13:30',
    '14:30',
    '15:30',
    '16:30',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  List<BacSi> get _filteredDoctors {
    if (_selectedDepartmentId == null) {
      return _doctors;
    }
    return _doctors
        .where((doctor) => doctor.maKhoa == _selectedDepartmentId)
        .toList();
  }

  Future<void> _loadData() async {
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
      final responses = await Future.wait([
        _api.get('/khoa'),
        _api.get('/bacsi'),
        _api.get('/lichkham/benhnhan/$patientId'),
      ]);

      final departmentData = _asList(_api.dataOf(responses[0]));
      final doctorData = _asList(_api.dataOf(responses[1]));
      final appointmentData = _asList(_api.dataOf(responses[2]));

      final departments = departmentData
          .map((item) => Khoa.fromJson(Map<String, dynamic>.from(item as Map)))
          .where((item) => item.maKhoa.isNotEmpty)
          .toList();
      final doctors = doctorData
          .map((item) => BacSi.fromJson(Map<String, dynamic>.from(item as Map)))
          .where((item) => item.maBS.isNotEmpty)
          .toList();
      final appointments = appointmentData
          .map(
            (item) => LichHenModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .where((item) => item.maLich.isNotEmpty)
          .toList()
        ..sort((a, b) {
          final dateComparison = b.ngayKham.compareTo(a.ngayKham);
          if (dateComparison != 0) return dateComparison;
          return b.gioKham.compareTo(a.gioKham);
        });

      if (!mounted) return;
      setState(() {
        _departments = departments;
        _doctors = doctors;
        _appointments = appointments;
        _selectedDepartmentId = departments.isNotEmpty
            ? departments.first.maKhoa
            : null;
        final filtered = _filteredDoctors;
        _selectedDoctorId = filtered.isNotEmpty ? filtered.first.maBS : null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Không thể tải lịch khám: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<dynamic> _asList(dynamic value) {
    if (value is List) return value;
    throw const FormatException('API không trả về danh sách.');
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final result = await showDatePicker(
      context: context,
      initialDate: _selectedDate.isBefore(now)
          ? now.add(const Duration(days: 1))
          : _selectedDate,
      firstDate: DateTime(now.year, now.month, now.day)
          .add(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 180)),
      locale: const Locale('vi', 'VN'),
    );
    if (result != null && mounted) {
      setState(() => _selectedDate = result);
    }
  }

  Future<void> _createAppointment() async {
    if (!_formKey.currentState!.validate()) return;

    final patientId = context.read<AuthProvider>().maBN;
    if (patientId == null || patientId.isEmpty) {
      _showSnack('Không tìm thấy mã bệnh nhân.');
      return;
    }
    if (_selectedDepartmentId == null || _selectedDoctorId == null) {
      _showSnack('Vui lòng chọn khoa và bác sĩ.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final response = await _api.post('/lichkham', {
        'maBN': patientId,
        'maKhoa': _selectedDepartmentId,
        'maBS': _selectedDoctorId,
        'ngayKham': DateFormat('yyyy-MM-dd').format(_selectedDate),
        'gioKham': _selectedTime,
        'ghiChu': _reasonController.text.trim(),
      });
      final created = Map<String, dynamic>.from(_api.dataOf(response) as Map);
      final appointment = LichHenModel.fromJson(created);

      if (!mounted) return;
      _reasonController.clear();
      _showSnack(
        appointment.soThuTu == null
            ? 'Đặt lịch thành công.'
            : 'Đặt lịch thành công. Số thứ tự: ${appointment.soThuTu}.',
        isError: false,
      );
      await _loadData();
    } catch (error) {
      _showSnack('Không thể đặt lịch: $error');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _cancelAppointment(LichHenModel appointment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hủy lịch khám'),
        content: Text(
          'Bạn có chắc muốn hủy lịch ngày ${appointment.ngayText} '
          'lúc ${appointment.gioKham}?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Không'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Hủy lịch'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final response = await _api.delete('/lichkham/${appointment.maLich}');
      _api.dataOf(response);
      if (!mounted) return;
      _showSnack('Đã hủy lịch khám.', isError: false);
      await _loadData();
    } catch (error) {
      _showSnack('Không thể hủy lịch: $error');
    }
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
    return Scaffold(
      appBar: AppBar(title: const Text('Lịch hẹn khám')),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Đặt lịch khám mới',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Chọn khoa, bác sĩ và thời gian phù hợp.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildBookingForm(),
            const SizedBox(height: 22),
            SectionHeader(
              title: 'Lịch của tôi',
              actionLabel: 'Làm mới',
              onAction: _loadData,
            ),
            const SizedBox(height: 12),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _MessageCard(
                icon: Icons.error_outline,
                message: _error!,
                color: AppTheme.danger,
              )
            else if (_appointments.isEmpty)
              const _MessageCard(
                icon: Icons.event_busy_outlined,
                message: 'Bạn chưa có lịch khám nào.',
              )
            else
              ..._appointments.map(_buildAppointmentCard),
          ],
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 1),
    );
  }

  Widget _buildBookingForm() {
    final doctors = _filteredDoctors;
    if (_selectedDoctorId != null &&
        !doctors.any((item) => item.maBS == _selectedDoctorId)) {
      _selectedDoctorId = doctors.isNotEmpty ? doctors.first.maBS : null;
    }

    return AppCard(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _selectedDepartmentId,
              decoration: const InputDecoration(labelText: 'Khoa'),
              items: _departments
                  .map(
                    (item) => DropdownMenuItem<String>(
                      value: item.maKhoa,
                      child: Text(item.tenKhoa),
                    ),
                  )
                  .toList(),
              onChanged: _isSubmitting
                  ? null
                  : (value) {
                      setState(() {
                        _selectedDepartmentId = value;
                        final filtered = _filteredDoctors;
                        _selectedDoctorId = filtered.isNotEmpty
                            ? filtered.first.maBS
                            : null;
                      });
                    },
              validator: (value) => value == null ? 'Vui lòng chọn khoa' : null,
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: _selectedDoctorId,
              decoration: const InputDecoration(labelText: 'Bác sĩ'),
              items: doctors
                  .map(
                    (item) => DropdownMenuItem<String>(
                      value: item.maBS,
                      child: Text(
                        item.chuyenMon == null || item.chuyenMon!.isEmpty
                            ? item.hoTen
                            : '${item.hoTen} - ${item.chuyenMon}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: _isSubmitting
                  ? null
                  : (value) => setState(() => _selectedDoctorId = value),
              validator: (value) => value == null ? 'Vui lòng chọn bác sĩ' : null,
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _isSubmitting ? null : _pickDate,
              icon: const Icon(Icons.calendar_month_outlined),
              label: Text(
                'Ngày khám: ${DateFormat('dd/MM/yyyy').format(_selectedDate)}',
              ),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: _selectedTime,
              decoration: const InputDecoration(labelText: 'Giờ khám'),
              items: _timeOptions
                  .map(
                    (time) => DropdownMenuItem<String>(
                      value: time,
                      child: Text(time),
                    ),
                  )
                  .toList(),
              onChanged: _isSubmitting
                  ? null
                  : (value) => setState(() => _selectedTime = value ?? '08:30'),
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _reasonController,
              maxLength: 1000,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Lý do khám/ghi chú',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 8),
            FilledButton.icon(
              onPressed: _isSubmitting ? null : _createAppointment,
              icon: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.event_available_outlined),
              label: Text(_isSubmitting ? 'Đang đặt lịch...' : 'Đặt lịch'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentCard(LichHenModel item) {
    final status = _statusInfo(item.trangThai);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: () => context.go('/patient/lich/${item.maLich}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.tenBS,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Chip(
                  label: Text(status.label),
                  avatar: Icon(status.icon, size: 18, color: status.color),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('${item.ngayText} • ${item.gioKham}'),
            if (item.soThuTu != null) ...[
              const SizedBox(height: 6),
              Text('Số thứ tự: ${item.soThuTu}'),
            ],
            if (item.phong.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Phòng: ${item.phong}'),
            ],
            if (item.ghiChu.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Ghi chú: ${item.ghiChu}'),
            ],
            if (item.canCancel) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _cancelAppointment(item),
                  icon: const Icon(Icons.cancel_outlined),
                  label: const Text('Hủy lịch'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  _StatusInfo _statusInfo(String value) {
    switch (value) {
      case 'CONFIRMED':
      case 'DA_XAC_NHAN':
        return const _StatusInfo('Đã xác nhận', Icons.verified_outlined, AppTheme.teal);
      case 'COMPLETED':
      case 'HOAN_THANH':
        return const _StatusInfo('Hoàn thành', Icons.task_alt, Colors.green);
      case 'CANCELLED':
      case 'DA_HUY':
        return const _StatusInfo('Đã hủy', Icons.cancel_outlined, AppTheme.danger);
      default:
        return const _StatusInfo('Chờ xác nhận', Icons.schedule, Colors.orange);
    }
  }
}

class _StatusInfo {
  const _StatusInfo(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({
    required this.icon,
    required this.message,
    this.color = Colors.blueGrey,
  });

  final IconData icon;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}
