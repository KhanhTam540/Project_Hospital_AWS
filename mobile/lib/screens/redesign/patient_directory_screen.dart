import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';

class PatientDirectoryScreen extends StatefulWidget {
  const PatientDirectoryScreen({super.key});

  @override
  State<PatientDirectoryScreen> createState() => _PatientDirectoryScreenState();
}

class _PatientDirectoryScreenState extends State<PatientDirectoryScreen> {
  final HospitalApiService _service = HospitalApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  String? _error;
  String _query = '';
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
      final patients = await _service.patients();
      if (!mounted) return;
      setState(() => _patients = patients);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _visible {
    final query = _query.trim().toLowerCase();
    if (query.isEmpty) return _patients;
    return _patients.where((patient) {
      return patient.values
          .map((value) => value.toString())
          .join(' ')
          .toLowerCase()
          .contains(query);
    }).toList();
  }

  Future<void> _showPatientDetails(
    Map<String, dynamic> patient,
    AuthProvider auth,
    bool canCreate,
  ) async {
    final id = firstText(patient, const ['maBN', 'patientId']);
    final name = firstText(patient, const ['hoTen', 'fullName']);
    Map<String, dynamic> detail = patient;
    try {
      detail = await _service.patientCore(id);
    } catch (_) {
      try {
        detail = await _service.patient(id);
      } catch (_) {
        detail = patient;
      }
    }
    if (!mounted) return;
    await showDataDetails(
      context,
      title: name,
      data: detail,
      labels: const {
        'maBN': 'Mã bệnh nhân',
        'patientId': 'Mã bệnh nhân',
        'hoTen': 'Họ tên',
        'fullName': 'Họ tên',
        'ngaySinh': 'Ngày sinh',
        'dateOfBirth': 'Ngày sinh',
        'gioiTinh': 'Giới tính',
        'gender': 'Giới tính',
        'soDienThoai': 'Số điện thoại',
        'phoneNumber': 'Số điện thoại',
        'diaChi': 'Địa chỉ',
        'address': 'Địa chỉ',
        'bhyt': 'Bảo hiểm y tế',
        'healthInsuranceNumber': 'Bảo hiểm y tế',
      },
      actions: [
        if (canCreate || (auth.role == 'BENHNHAN' && id == auth.maBN))
          FilledButton.icon(
            onPressed: () {
              Navigator.of(context).pop();
              _openForm(patient: detail);
            },
            icon: const Icon(Icons.edit_rounded),
            label: const Text('Chỉnh sửa'),
          ),
      ],
    );
  }

  Future<void> _openForm({Map<String, dynamic>? patient}) async {
    final auth = context.read<AuthProvider>();
    final canCreate = auth.role == 'ADMIN' || auth.role == 'NHANSU';
    final canEdit = canCreate ||
        (auth.role == 'BENHNHAN' &&
            firstText(patient ?? const {}, const ['maBN', 'patientId']) == auth.maBN);
    if (patient == null && !canCreate) return;
    if (patient != null && !canEdit) return;

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => _PatientFormSheet(patient: patient),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final canCreate = auth.role == 'ADMIN' || auth.role == 'NHANSU';
    final visible = _visible;

    return HospitalPage(
      onRefresh: _load,
      floatingActionButton: canCreate
          ? FloatingActionButton.extended(
              onPressed: () => _openForm(),
              icon: const Icon(Icons.person_add_rounded),
              label: const Text('Thêm bệnh nhân'),
            )
          : null,
      children: [
        PageHeader(
          title: 'Hồ sơ bệnh nhân',
          subtitle: 'Tra cứu, đăng ký và cập nhật thông tin bệnh nhân.',
          icon: Icons.personal_injury_rounded,
          badge: const EndpointBadge(method: 'GET/POST/PUT', path: '/benhnhan · /patients'),
          actions: [
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Làm mới'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        SearchField(
          controller: _searchController,
          hint: 'Tìm theo mã bệnh nhân, họ tên, số điện thoại...',
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 14),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else if (visible.isEmpty)
          EmptyState(
            title: 'Chưa có bệnh nhân',
            message: canCreate
                ? 'Nhấn “Thêm bệnh nhân” để tạo hồ sơ mới.'
                : 'Không có hồ sơ phù hợp với từ khóa.',
            icon: Icons.person_search_rounded,
          )
        else
          ...visible.map((patient) {
            final id = firstText(patient, const ['maBN', 'patientId']);
            final name = firstText(patient, const ['hoTen', 'fullName']);
            final phone = firstText(patient, const ['soDienThoai', 'phoneNumber']);
            final insurance = firstText(patient, const ['bhyt', 'healthInsuranceNumber']);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: DataListTile(
                title: name,
                subtitle: '$id · $phone · BHYT: $insurance',
                icon: Icons.person_rounded,
                status: firstText(patient, const ['trangThai', 'status'], fallback: ''),
                onTap: () => _showPatientDetails(patient, auth, canCreate),
              ),
            );
          }),
      ],
    );
  }
}

class _PatientFormSheet extends StatefulWidget {
  const _PatientFormSheet({this.patient});
  final Map<String, dynamic>? patient;

  @override
  State<_PatientFormSheet> createState() => _PatientFormSheetState();
}

class _PatientFormSheetState extends State<_PatientFormSheet> {
  final _formKey = GlobalKey<FormState>();
  final HospitalApiService _service = HospitalApiService();
  late final TextEditingController _name;
  late final TextEditingController _birthDate;
  late final TextEditingController _phone;
  late final TextEditingController _address;
  late final TextEditingController _insurance;
  String _gender = 'NAM';
  bool _saving = false;

  bool get _editing => widget.patient != null;

  @override
  void initState() {
    super.initState();
    final patient = widget.patient ?? const <String, dynamic>{};
    _name = TextEditingController(text: firstText(patient, const ['hoTen', 'fullName'], fallback: ''));
    _birthDate = TextEditingController(text: firstText(patient, const ['ngaySinh', 'dateOfBirth'], fallback: ''));
    _phone = TextEditingController(text: firstText(patient, const ['soDienThoai', 'phoneNumber'], fallback: ''));
    _address = TextEditingController(text: firstText(patient, const ['diaChi', 'address'], fallback: ''));
    _insurance = TextEditingController(text: firstText(patient, const ['bhyt', 'healthInsuranceNumber'], fallback: ''));
    final gender = firstText(patient, const ['gioiTinh', 'gender'], fallback: 'NAM').toUpperCase();
    _gender = gender == 'NỮ' || gender == 'NU' ? 'NU' : gender == 'KHÁC' || gender == 'KHAC' ? 'KHAC' : 'NAM';
  }

  @override
  void dispose() {
    _name.dispose();
    _birthDate.dispose();
    _phone.dispose();
    _address.dispose();
    _insurance.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final body = {
      'fullName': _name.text.trim(),
      'dateOfBirth': _birthDate.text.trim(),
      'gender': _gender,
      'phoneNumber': _phone.text.trim(),
      'address': _address.text.trim(),
      'healthInsuranceNumber': _insurance.text.trim(),
    };
    try {
      if (_editing) {
        final id = firstText(widget.patient!, const ['patientId', 'maBN']);
        await _service.updatePatient(id, body);
      } else {
        await _service.createPatient(body);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
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
                _editing ? 'Cập nhật bệnh nhân' : 'Đăng ký bệnh nhân',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 18),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Họ và tên', prefixIcon: Icon(Icons.person_rounded)),
                validator: (value) => value == null || value.trim().isEmpty ? 'Vui lòng nhập họ tên' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _birthDate,
                decoration: const InputDecoration(labelText: 'Ngày sinh (YYYY-MM-DD)', prefixIcon: Icon(Icons.cake_rounded)),
                validator: (value) => value == null || !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value.trim()) ? 'Nhập đúng định dạng YYYY-MM-DD' : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _gender,
                decoration: const InputDecoration(labelText: 'Giới tính', prefixIcon: Icon(Icons.wc_rounded)),
                items: const [
                  DropdownMenuItem(value: 'NAM', child: Text('Nam')),
                  DropdownMenuItem(value: 'NU', child: Text('Nữ')),
                  DropdownMenuItem(value: 'KHAC', child: Text('Khác')),
                ],
                onChanged: (value) => setState(() => _gender = value ?? 'NAM'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Số điện thoại', prefixIcon: Icon(Icons.phone_rounded)),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _insurance,
                decoration: const InputDecoration(labelText: 'Mã BHYT', prefixIcon: Icon(Icons.health_and_safety_rounded)),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _address,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Địa chỉ', prefixIcon: Icon(Icons.location_on_rounded)),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _saving ? null : _save,
                  icon: _saving
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.save_rounded),
                  label: Text(_editing ? 'Lưu thay đổi' : 'Tạo hồ sơ'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
