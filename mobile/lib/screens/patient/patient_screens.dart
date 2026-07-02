import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import '../../theme/app_theme.dart';
import '../../widgets/app_components.dart';
import 'patient_bottom_nav_bar.dart';

class BacSi {
  const BacSi({
    required this.maBS,
    required this.hoTen,
    required this.tenKhoa,
    this.hinhAnh,
  });

  final String maBS;
  final String hoTen;
  final String tenKhoa;
  final String? hinhAnh;

  factory BacSi.fromJson(Map<String, dynamic> json) {
    return BacSi(
      maBS: json['maBS']?.toString() ?? '',
      hoTen: json['hoTen']?.toString() ?? 'Bác sĩ',
      tenKhoa:
          json['Khoa']?['tenKhoa']?.toString() ??
          json['chuyenKhoa']?.toString() ??
          'Chuyên khoa',
      hinhAnh: json['hinhAnh']?.toString(),
    );
  }
}

class PatientHome extends StatefulWidget {
  const PatientHome({super.key});

  @override
  State<PatientHome> createState() => _PatientHomeState();
}

class _PatientHomeState extends State<PatientHome> {
  final ApiClient _api = ApiClient();
  List<BacSi> _bacSiList = [];
  bool _isLoadingBacSi = true;
  String? _doctorError;

  @override
  void initState() {
    super.initState();
    _fetchBacSiWorkingToday();
  }

  Future<void> _fetchBacSiWorkingToday() async {
    setState(() {
      _isLoadingBacSi = true;
      _doctorError = null;
    });

    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final resLich = await _api.get('/lichlamviec');

      if (resLich.statusCode != 200) {
        throw Exception('Không thể tải lịch làm việc');
      }

      final dataLich = jsonDecode(resLich.body)['data'] as List;
      final maBsHomNay = dataLich
          .where((lich) {
            final ngayLamViec = lich['ngayLamViec']?.toString().split('T')[0];
            return ngayLamViec == today && lich['maBS'] != null;
          })
          .map((lich) => lich['maBS'].toString())
          .toSet();

      if (maBsHomNay.isEmpty) {
        if (!mounted) return;
        setState(() => _bacSiList = []);
        return;
      }

      final resBacSi = await _api.get('/bacsi');
      if (resBacSi.statusCode != 200) {
        throw Exception('Không thể tải danh sách bác sĩ');
      }

      final dataBacSi = jsonDecode(resBacSi.body)['data'] as List;
      final bacSiLamViecHomNay = dataBacSi
          .map((item) => BacSi.fromJson(item as Map<String, dynamic>))
          .where((bacSi) => maBsHomNay.contains(bacSi.maBS))
          .toList();

      if (!mounted) return;
      setState(() => _bacSiList = bacSiLamViecHomNay);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _doctorError = 'Chưa tải được danh sách bác sĩ hôm nay';
        _bacSiList = [];
      });
    } finally {
      if (mounted) {
        setState(() => _isLoadingBacSi = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final displayName = auth.tenDangNhap ?? 'Bệnh nhân';

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _fetchBacSiWorkingToday,
          child: CustomScrollView(
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    _Header(displayName: displayName),
                    const SizedBox(height: 18),
                    _CareStatusCard(onBook: () => context.go('/patient/lich')),
                    const SizedBox(height: 22),
                    const SectionHeader(title: 'Dịch vụ của bạn'),
                    const SizedBox(height: 12),
                    _QuickActionGrid(),
                    const SizedBox(height: 24),
                    SectionHeader(
                      title: 'Bác sĩ hôm nay',
                      actionLabel: 'Làm mới',
                      onAction: _fetchBacSiWorkingToday,
                    ),
                    const SizedBox(height: 12),
                    _DoctorSection(
                      isLoading: _isLoadingBacSi,
                      error: _doctorError,
                      doctors: _bacSiList,
                    ),
                    const SizedBox(height: 26),
                    _HelpCard(),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: const PatientBottomNavBar(currentIndex: 0),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.displayName});

  final String displayName;

  @override
  Widget build(BuildContext context) {
    final now = DateFormat('dd/MM/yyyy').format(DateTime.now());

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(now, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 6),
              Text(
                'Xin chào, $displayName',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ],
          ),
        ),
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: Theme.of(
              context,
            ).colorScheme.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            Icons.notifications_none_rounded,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ],
    );
  }
}

class _CareStatusCard extends StatelessWidget {
  const _CareStatusCard({required this.onBook});

  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.secondary.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  Icons.health_and_safety_rounded,
                  color: Theme.of(context).colorScheme.secondary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Chăm sóc sức khỏe chủ động',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Đặt lịch, xem hồ sơ và theo dõi chi phí trên một ứng dụng.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: onBook,
            icon: const Icon(Icons.event_available_rounded),
            label: const Text('Đặt lịch khám'),
          ),
        ],
      ),
    );
  }
}

class _QuickActionGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final actions = [
      _ActionItem(
        icon: Icons.calendar_month_rounded,
        title: 'Lịch hẹn',
        subtitle: 'Đặt và theo dõi',
        route: '/patient/lich',
        color: Theme.of(context).colorScheme.primary,
      ),
      const _ActionItem(
        icon: Icons.folder_shared_rounded,
        title: 'Hồ sơ',
        subtitle: 'Bệnh án cá nhân',
        route: '/patient/hoso',
        color: AppTheme.teal,
      ),
      const _ActionItem(
        icon: Icons.biotech_rounded,
        title: 'Xét nghiệm',
        subtitle: 'Kết quả mới nhất',
        route: '/patient/xetnghiem',
        color: Color(0xFF7C5CC4),
      ),
      const _ActionItem(
        icon: Icons.receipt_long_rounded,
        title: 'Hóa đơn',
        subtitle: 'Thanh toán QR',
        route: '/patient/hoadon',
        color: Color(0xFFD1842F),
      ),
      const _ActionItem(
        icon: Icons.person_rounded,
        title: 'Tài khoản',
        subtitle: 'Thông tin cá nhân',
        route: '/patient/taikhoan',
        color: Color(0xFF2E7D9A),
      ),
      const _ActionItem(
        icon: Icons.smart_toy_rounded,
        title: 'Trợ lý AI',
        subtitle: 'Hỏi đáp sức khỏe',
        route: '/chatbot',
        color: Color(0xFF9A55B5),
      ),
    ];

    return GridView.builder(
      itemCount: actions.length,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.08,
      ),
      itemBuilder: (context, index) {
        final action = actions[index];
        return AppIconTile(
          icon: action.icon,
          title: action.title,
          subtitle: action.subtitle,
          color: action.color,
          onTap: () => context.go(action.route),
        );
      },
    );
  }
}

class _ActionItem {
  const _ActionItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.route,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String route;
  final Color color;
}

class _DoctorSection extends StatelessWidget {
  const _DoctorSection({
    required this.isLoading,
    required this.error,
    required this.doctors,
  });

  final bool isLoading;
  final String? error;
  final List<BacSi> doctors;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const AppCard(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(12),
            child: CircularProgressIndicator(),
          ),
        ),
      );
    }

    if (doctors.isEmpty) {
      return AppCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              error == null
                  ? Icons.event_available_rounded
                  : Icons.cloud_off_rounded,
              color: Theme.of(context).colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                error ?? 'Hôm nay chưa có bác sĩ trong lịch làm việc.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: doctors
          .map(
            (doctor) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: AppCard(
                padding: const EdgeInsets.all(14),
                onTap: () => context.go('/patient/lich'),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 26,
                      backgroundColor: Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.12),
                      backgroundImage:
                          doctor.hinhAnh != null && doctor.hinhAnh!.isNotEmpty
                          ? NetworkImage(doctor.hinhAnh!)
                          : null,
                      child: doctor.hinhAnh == null || doctor.hinhAnh!.isEmpty
                          ? Icon(
                              Icons.medical_services_rounded,
                              color: Theme.of(context).colorScheme.primary,
                            )
                          : null,
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor.hoTen,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            doctor.tenKhoa,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right_rounded, color: context.appMuted),
                  ],
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}

class _HelpCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppTheme.danger.withValues(
                alpha: context.isDark ? 0.20 : 0.10,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.support_agent_rounded,
              color: AppTheme.danger,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Cần hỗ trợ?',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 3),
                Text(
                  'Hotline bệnh viện: 1900 6422',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
