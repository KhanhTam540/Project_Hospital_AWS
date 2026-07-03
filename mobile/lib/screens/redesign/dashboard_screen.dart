import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../navigation/hospital_navigation.dart';
import '../../services/hospital_api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/hospital_ui.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final HospitalApiService _service = HospitalApiService();

  bool _loading = true;
  String? _error;
  Map<String, dynamic> _health = const {};
  Map<String, dynamic> _me = const {};
  List<Map<String, dynamic>> _patients = const [];
  List<Map<String, dynamic>> _doctors = const [];
  List<Map<String, dynamic>> _appointments = const [];
  List<Map<String, dynamic>> _records = const [];
  List<Map<String, dynamic>> _labResults = const [];
  Map<String, dynamic> _accountSummary = const {};

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
      final futures = <Future<void>>[
        _safeObject(() => _service.health(), (value) => _health = value),
        _safeObject(() => _service.me(), (value) => _me = value),
        _safeList(() => _service.doctors(), (value) => _doctors = value),
      ];

      if (auth.role == 'ADMIN') {
        futures.addAll([
          _safeList(() => _service.patients(), (value) => _patients = value),
          _safeList(
            () => _service.appointments(),
            (value) => _appointments = value,
          ),
          _safeObject(
            () => _service.accountSummary(),
            (value) => _accountSummary = value,
          ),
        ]);
      } else if (auth.role == 'BACSI') {
        futures.addAll([
          _safeList(() => _service.patients(), (value) => _patients = value),
          _safeList(
            () => _service.appointments(doctorId: auth.maBS),
            (value) => _appointments = value,
          ),
        ]);
      } else if (auth.role == 'NHANSU') {
        futures.addAll([
          _safeList(() => _service.patients(), (value) => _patients = value),
          _safeList(
            () => _service.appointments(),
            (value) => _appointments = value,
          ),
          _safeList(
            () => _service.labResults(),
            (value) => _labResults = value,
          ),
        ]);
      } else if (auth.role == 'BENHNHAN') {
        final patientId = auth.maBN;
        futures.addAll([
          _safeList(
            () => _service.appointments(patientId: patientId),
            (value) => _appointments = value,
          ),
          if (patientId != null && patientId.isNotEmpty)
            _safeList(
              () => _service.records(patientId),
              (value) => _records = value,
            ),
          _safeList(
            () => _service.labResults(patientId: patientId),
            (value) => _labResults = value,
          ),
        ]);
      }

      await Future.wait(futures);
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _safeList(
    Future<List<Map<String, dynamic>>> Function() loader,
    void Function(List<Map<String, dynamic>>) assign,
  ) async {
    try {
      assign(await loader());
    } catch (_) {
      assign(const []);
    }
  }

  Future<void> _safeObject(
    Future<Map<String, dynamic>> Function() loader,
    void Function(Map<String, dynamic>) assign,
  ) async {
    try {
      assign(await loader());
    } catch (_) {
      assign(const {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final name = firstText(_me, const [
      'fullName',
      'hoTen',
      'username',
      'tenDangNhap',
      'email',
    ], fallback: auth.tenDangNhap ?? auth.email ?? 'bạn');
    final status = firstText(_health, const ['status'], fallback: 'unknown');
    final nextAppointment = _upcomingAppointment();
    final navItems = HospitalNavigation.forAuth(auth)
        .where((item) => !const ['/home', '/profile'].contains(item.route))
        .take(8)
        .toList();

    return HospitalPage(
      onRefresh: _load,
      children: [
        _HeroBanner(
          name: name,
          role: _roleLabel(auth),
          systemOnline: status.toLowerCase() == 'ok',
          onAiTap: () => context.go('/ai'),
        ),
        const SizedBox(height: 22),
        if (_loading)
          const LoadingState(label: 'Đang tổng hợp dữ liệu dashboard...')
        else if (_error != null)
          ErrorState(message: _error!, onRetry: _load)
        else ...[
          ResponsiveGrid(children: _metrics(auth)),
          const SizedBox(height: 26),
          const SectionTitle(
            title: 'Truy cập nhanh',
            subtitle: 'Các chức năng phù hợp với vai trò hiện tại',
          ),
          const SizedBox(height: 12),
          ResponsiveGrid(
            minItemWidth: 300,
            children: navItems
                .map(
                  (item) => FeatureCard(
                    title: item.label,
                    subtitle: item.description,
                    icon: item.icon,
                    onTap: () => context.go(item.route),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 26),
          SectionTitle(
            title: auth.role == 'BENHNHAN'
                ? 'Lịch khám gần nhất'
                : 'Hoạt động cần chú ý',
            subtitle: auth.role == 'BENHNHAN'
                ? 'Thông tin lịch khám sắp tới của bạn'
                : 'Dữ liệu mới nhất được tải từ backend',
            action: TextButton(
              onPressed: () => context.go('/appointments'),
              child: const Text('Xem lịch khám'),
            ),
          ),
          const SizedBox(height: 12),
          if (nextAppointment == null)
            const EmptyState(
              title: 'Chưa có lịch khám sắp tới',
              message:
                  'Bạn có thể mở mục Lịch khám để tạo hoặc theo dõi lịch hẹn.',
              icon: Icons.event_busy_rounded,
            )
          else
            _AppointmentPreview(
              item: nextAppointment,
              onTap: () => context.go('/appointments'),
            ),
        ],
      ],
    );
  }

  List<Widget> _metrics(AuthProvider auth) {
    if (auth.role == 'ADMIN') {
      return [
        MetricCard(
          label: 'Tài khoản',
          value: firstText(_accountSummary, const [
            'total',
          ], fallback: _summaryTotal()),
          icon: Icons.manage_accounts_rounded,
          color: AppTheme.primary,
          onTap: () => context.go('/accounts'),
        ),
        MetricCard(
          label: 'Bệnh nhân',
          value: '${_patients.length}',
          icon: Icons.personal_injury_rounded,
          color: AppTheme.teal,
          onTap: () => context.go('/patients'),
        ),
        MetricCard(
          label: 'Bác sĩ',
          value: '${_doctors.length}',
          icon: Icons.medical_services_rounded,
          color: const Color(0xFF7C3AED),
          onTap: () => context.go('/doctors'),
        ),
        MetricCard(
          label: 'Lịch khám',
          value: '${_appointments.length}',
          icon: Icons.calendar_month_rounded,
          color: AppTheme.warning,
          onTap: () => context.go('/appointments'),
        ),
      ];
    }

    if (auth.role == 'BENHNHAN') {
      return [
        MetricCard(
          label: 'Lịch khám',
          value: '${_appointments.length}',
          icon: Icons.calendar_month_rounded,
          onTap: () => context.go('/appointments'),
        ),
        MetricCard(
          label: 'Hồ sơ bệnh án',
          value: '${_records.length}',
          icon: Icons.cleaning_services_outlined,
          color: AppTheme.teal,
          onTap: () => context.go('/clinical'),
        ),
        MetricCard(
          label: 'Kết quả xét nghiệm',
          value: '${_labResults.length}',
          icon: Icons.science_rounded,
          color: const Color(0xFF7C3AED),
          onTap: () => context.go('/laboratory'),
        ),
        MetricCard(
          label: 'Bác sĩ',
          value: '${_doctors.length}',
          icon: Icons.medical_services_rounded,
          color: AppTheme.warning,
          onTap: () => context.go('/doctors'),
        ),
      ];
    }

    return [
      MetricCard(
        label: 'Bệnh nhân',
        value: '${_patients.length}',
        icon: Icons.personal_injury_rounded,
        color: AppTheme.teal,
        onTap: () => context.go('/patients'),
      ),
      MetricCard(
        label: 'Lịch khám',
        value: '${_appointments.length}',
        icon: Icons.calendar_month_rounded,
        color: AppTheme.primary,
        onTap: () => context.go('/appointments'),
      ),
      MetricCard(
        label: 'Kết quả xét nghiệm',
        value: '${_labResults.length}',
        icon: Icons.science_rounded,
        color: const Color(0xFF7C3AED),
        onTap: () => context.go('/laboratory'),
      ),
      MetricCard(
        label: 'Bác sĩ',
        value: '${_doctors.length}',
        icon: Icons.medical_services_rounded,
        color: AppTheme.warning,
        onTap: () => context.go('/doctors'),
      ),
    ];
  }

  String _summaryTotal() {
    final values = [
      'admin',
      'doctor',
      'staff',
      'patient',
    ].map((key) => int.tryParse((_accountSummary[key] ?? 0).toString()) ?? 0);
    return '${values.fold<int>(0, (total, value) => total + value)}';
  }

  Map<String, dynamic>? _upcomingAppointment() {
    if (_appointments.isEmpty) return null;
    final copy = [..._appointments];
    copy.sort((a, b) {
      final aDate = firstText(a, const [
        'appointmentDate',
        'ngayKham',
        'ngayHen',
      ], fallback: '9999');
      final bDate = firstText(b, const [
        'appointmentDate',
        'ngayKham',
        'ngayHen',
      ], fallback: '9999');
      return aDate.compareTo(bDate);
    });
    return copy.first;
  }
}

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({
    required this.name,
    required this.role,
    required this.systemOnline,
    required this.onAiTap,
  });

  final String name;
  final String role;
  final bool systemOnline;
  final VoidCallback onAiTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF115FC4), Color(0xFF0F9F8F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.20),
            blurRadius: 30,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 620;
          final text = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          systemOnline
                              ? Icons.cloud_done_rounded
                              : Icons.cloud_off_rounded,
                          color: Colors.white,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          systemOnline
                              ? 'AWS đang hoạt động'
                              : 'Đang kiểm tra AWS',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Xin chào, $name',
                style: Theme.of(
                  context,
                ).textTheme.headlineLarge?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 7),
              Text(
                '$role · Quản lý công việc và dữ liệu y tế trong một giao diện thống nhất.',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.88),
                ),
              ),
            ],
          );

          final action = FilledButton.icon(
            onPressed: onAiTap,
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: AppTheme.primary,
            ),
            icon: const Icon(Icons.auto_awesome_rounded),
            label: const Text('Hỏi trợ lý AI'),
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [text, const SizedBox(height: 18), action],
            );
          }

          return Row(
            children: [
              Expanded(child: text),
              const SizedBox(width: 24),
              action,
            ],
          );
        },
      ),
    );
  }
}

class _AppointmentPreview extends StatelessWidget {
  const _AppointmentPreview({required this.item, required this.onTap});

  final Map<String, dynamic> item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final doctor = firstText(item, const [
      'tenBacSi',
      'BacSi',
      'maBS',
      'doctorId',
    ]);
    final date = firstText(item, const [
      'ngayKham',
      'appointmentDate',
      'ngayHen',
    ]);
    final time = firstText(item, const ['gioKham', 'appointmentTime', 'maCa']);
    final status = firstText(item, const ['trangThai', 'status']);
    final queue = firstText(item, const [
      'soThuTu',
      'queueNumber',
    ], fallback: '—');

    return HospitalCard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.event_note_rounded, size: 30),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doctor, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  '$date · $time',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 5),
                Text(
                  'Số thứ tự: $queue',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          StatusBadge(status),
        ],
      ),
    );
  }
}

String _roleLabel(AuthProvider auth) {
  switch (auth.role) {
    case 'ADMIN':
      return 'Quản trị viên';
    case 'BACSI':
      return 'Bác sĩ';
    case 'BENHNHAN':
      return 'Bệnh nhân';
    case 'NHANSU':
      return 'Nhân sự y tế';
    default:
      return 'Người dùng';
  }
}
