import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/hospital_api_service.dart';
import '../../widgets/hospital_ui.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final HospitalApiService _service = HospitalApiService();
  bool _loading = true;
  String? _error;
  Map<String, dynamic> _account = const {};
  Map<String, dynamic> _domainProfile = const {};

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
      final auth = context.read<AuthProvider>();
      final account = await _service.me();
      Map<String, dynamic> domain = const {};
      if (auth.role == 'BENHNHAN' && (auth.maTK ?? '').isNotEmpty) {
        domain = await _service.patientByAccount(auth.maTK!);
      } else if (auth.role == 'BACSI' && (auth.maBS ?? '').isNotEmpty) {
        domain = await _service.getObject(
          '/bacsi/maTK/${Uri.encodeComponent(auth.maTK ?? '')}',
        );
      } else if (auth.role == 'NHANSU' && (auth.maTK ?? '').isNotEmpty) {
        domain = await _service.getObject('/nhansu/maTK/${Uri.encodeComponent(auth.maTK!)}');
      }
      if (!mounted) return;
      setState(() {
        _account = account;
        _domainProfile = domain;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _editPatient() async {
    final auth = context.read<AuthProvider>();
    final patientId = auth.maBN ??
        firstText(_domainProfile, const ['maBN', 'patientId'], fallback: '');
    if (patientId.isEmpty) return;

    final fullName = TextEditingController(
      text: firstText(_domainProfile, const ['hoTen', 'fullName'], fallback: ''),
    );
    final phone = TextEditingController(
      text: firstText(
        _domainProfile,
        const ['soDienThoai', 'phoneNumber'],
        fallback: '',
      ),
    );
    final address = TextEditingController(
      text: firstText(_domainProfile, const ['diaChi', 'address'], fallback: ''),
    );
    final insurance = TextEditingController(
      text: firstText(
        _domainProfile,
        const ['bhyt', 'healthInsuranceNumber'],
        fallback: '',
      ),
    );

    final shouldSave = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cập nhật hồ sơ bệnh nhân'),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: fullName,
                  decoration: const InputDecoration(
                    labelText: 'Họ tên',
                    prefixIcon: Icon(Icons.person_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Số điện thoại',
                    prefixIcon: Icon(Icons.phone_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: address,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    labelText: 'Địa chỉ',
                    prefixIcon: Icon(Icons.location_on_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: insurance,
                  decoration: const InputDecoration(
                    labelText: 'Mã BHYT',
                    prefixIcon: Icon(Icons.health_and_safety_rounded),
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Lưu'),
          ),
        ],
      ),
    );

    if (shouldSave != true) return;
    try {
      await _service.updatePatient(patientId, {
        'fullName': fullName.text.trim(),
        'phoneNumber': phone.text.trim(),
        'address': address.text.trim(),
        'healthInsuranceNumber': insurance.text.trim(),
      });
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đã cập nhật hồ sơ.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể cập nhật: $error')),
      );
    }
  }

  Future<void> _changePassword() async {
    final authProvider = context.read<AuthProvider>();
    final oldPassword = TextEditingController();
    final newPassword = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Đổi mật khẩu'),
        content: SizedBox(
          width: 460,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: oldPassword,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: newPassword,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Đổi mật khẩu'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await authProvider.changePassword(
        oldPassword: oldPassword.text,
        newPassword: newPassword.text,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Đổi mật khẩu thành công.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể đổi mật khẩu: $error')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final merged = <String, dynamic>{..._account, ..._domainProfile};

    return HospitalPage(
      onRefresh: _load,
      children: [
        PageHeader(
          title: 'Hồ sơ cá nhân',
          subtitle: 'Thông tin tài khoản Cognito và hồ sơ nghiệp vụ tương ứng.',
          icon: Icons.account_circle_rounded,
          badge: const EndpointBadge(method: 'GET', path: '/me'),
          actions: [
            if (auth.role == 'BENHNHAN')
              FilledButton.icon(
                onPressed: _loading ? null : _editPatient,
                icon: const Icon(Icons.edit_rounded),
                label: const Text('Cập nhật'),
              ),
            OutlinedButton.icon(
              onPressed: _changePassword,
              icon: const Icon(Icons.password_rounded),
              label: const Text('Đổi mật khẩu'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        if (_loading)
          const LoadingState()
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else ...[
          HospitalCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 34,
                  child: Text(
                    (auth.tenDangNhap ?? auth.email ?? 'U')
                        .trim()
                        .substring(0, 1)
                        .toUpperCase(),
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        auth.tenDangNhap ?? auth.email ?? 'Người dùng',
                        style: Theme.of(context).textTheme.headlineMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(auth.email ?? 'Chưa có email'),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          StatusBadge(auth.role ?? 'UNKNOWN'),
                          if ((auth.loaiNS ?? '').isNotEmpty)
                            StatusBadge(auth.loaiNS!),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const SectionTitle(
            title: 'Thông tin chi tiết',
            subtitle: 'Dữ liệu được đọc trực tiếp từ backend.',
          ),
          const SizedBox(height: 12),
          HospitalCard(
            child: KeyValueGrid(
              data: merged,
              labels: const {
                'maTK': 'Mã tài khoản',
                'appUserId': 'Mã tài khoản',
                'username': 'Tên đăng nhập',
                'tenDangNhap': 'Tên đăng nhập',
                'email': 'Email',
                'role': 'Vai trò',
                'primaryRole': 'Vai trò',
                'maNhom': 'Nhóm quyền',
                'maBN': 'Mã bệnh nhân',
                'patientId': 'Mã bệnh nhân',
                'maBS': 'Mã bác sĩ',
                'doctorId': 'Mã bác sĩ',
                'maNS': 'Mã nhân sự',
                'staffId': 'Mã nhân sự',
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
                'bhyt': 'BHYT',
                'healthInsuranceNumber': 'BHYT',
                'chuyenMon': 'Chuyên môn',
                'specialty': 'Chuyên môn',
                'loaiNS': 'Loại nhân sự',
                'staffType': 'Loại nhân sự',
              },
            ),
          ),
        ],
      ],
    );
  }
}
