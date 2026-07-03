import 'package:flutter/material.dart';

import '../auth/auth_provider.dart';

class HospitalNavItem {
  const HospitalNavItem({
    required this.label,
    required this.route,
    required this.icon,
    required this.group,
    this.description = '',
    this.primary = false,
  });

  final String label;
  final String route;
  final IconData icon;
  final String group;
  final String description;
  final bool primary;
}

class HospitalNavigation {
  HospitalNavigation._();

  static const HospitalNavItem home = HospitalNavItem(
    label: 'Tổng quan',
    route: '/home',
    icon: Icons.dashboard_rounded,
    group: 'Chung',
    description: 'Tình trạng hệ thống và công việc hôm nay',
    primary: true,
  );

  static const HospitalNavItem profile = HospitalNavItem(
    label: 'Hồ sơ cá nhân',
    route: '/profile',
    icon: Icons.account_circle_rounded,
    group: 'Chung',
    description: 'Thông tin tài khoản và hồ sơ chuyên môn',
    primary: true,
  );

  static const HospitalNavItem ai = HospitalNavItem(
    label: 'Trợ lý AI',
    route: '/ai',
    icon: Icons.auto_awesome_rounded,
    group: 'Chung',
    description: 'Hỏi đáp và tóm tắt dữ liệu qua Gemini',
    primary: true,
  );

  static const List<HospitalNavItem> _admin = [
    home,
    HospitalNavItem(
      label: 'Tài khoản',
      route: '/accounts',
      icon: Icons.manage_accounts_rounded,
      group: 'Quản trị',
      description: 'Danh sách tài khoản, phân quyền và vô hiệu hóa',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Bệnh nhân',
      route: '/patients',
      icon: Icons.personal_injury_rounded,
      group: 'Danh mục',
      description: 'Hồ sơ bệnh nhân và thông tin liên hệ',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Bác sĩ',
      route: '/doctors',
      icon: Icons.medical_services_rounded,
      group: 'Danh mục',
      description: 'Danh sách bác sĩ và chuyên khoa',
    ),
    HospitalNavItem(
      label: 'Nhân sự',
      route: '/staff',
      icon: Icons.badge_rounded,
      group: 'Danh mục',
      description: 'Y tá, tiếp nhận và nhân viên xét nghiệm',
    ),
    HospitalNavItem(
      label: 'Khoa',
      route: '/departments',
      icon: Icons.apartment_rounded,
      group: 'Danh mục',
      description: 'Khoa chuyên môn trong bệnh viện',
    ),
    HospitalNavItem(
      label: 'Phòng khám',
      route: '/rooms',
      icon: Icons.meeting_room_rounded,
      group: 'Danh mục',
      description: 'Phòng khám và trạng thái sử dụng',
    ),
    HospitalNavItem(
      label: 'Lịch khám',
      route: '/appointments',
      icon: Icons.calendar_month_rounded,
      group: 'Vận hành',
      description: 'Quản lý lịch hẹn của toàn bệnh viện',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Lịch làm việc',
      route: '/schedules',
      icon: Icons.event_available_rounded,
      group: 'Vận hành',
      description: 'Lịch làm việc và ca trực',
    ),
    HospitalNavItem(
      label: 'Hồ sơ lâm sàng',
      route: '/clinical',
      icon: Icons.cleaning_services_outlined,
      group: 'Chuyên môn',
      description: 'Bệnh án, phiếu khám, đơn thuốc và tài liệu',
    ),
    HospitalNavItem(
      label: 'Dược',
      route: '/pharmacy',
      icon: Icons.medication_rounded,
      group: 'Chuyên môn',
      description: 'Thuốc, nhóm thuốc và đơn vị tính',
    ),
    HospitalNavItem(
      label: 'Xét nghiệm',
      route: '/laboratory',
      icon: Icons.science_rounded,
      group: 'Chuyên môn',
      description: 'Yêu cầu và kết quả xét nghiệm',
    ),
    HospitalNavItem(
      label: 'Hóa đơn',
      route: '/billing',
      icon: Icons.receipt_long_rounded,
      group: 'Tài chính',
      description: 'Danh sách và thống kê hóa đơn',
    ),
    ai,
    profile,
    HospitalNavItem(
      label: 'Danh mục API',
      route: '/api-catalog',
      icon: Icons.hub_rounded,
      group: 'Hệ thống',
      description: 'Đối chiếu toàn bộ API backend đã có giao diện',
    ),
  ];

  static const List<HospitalNavItem> _doctor = [
    home,
    HospitalNavItem(
      label: 'Lịch hẹn',
      route: '/appointments',
      icon: Icons.calendar_month_rounded,
      group: 'Khám bệnh',
      description: 'Lịch hẹn bệnh nhân của bác sĩ',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Bệnh nhân',
      route: '/patients',
      icon: Icons.personal_injury_rounded,
      group: 'Khám bệnh',
      description: 'Tra cứu hồ sơ bệnh nhân',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Hồ sơ lâm sàng',
      route: '/clinical',
      icon: Icons.cleaning_services_outlined,
      group: 'Khám bệnh',
      description: 'Tạo bệnh án, phiếu khám và đơn thuốc',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Lịch làm việc',
      route: '/schedules',
      icon: Icons.event_available_rounded,
      group: 'Cá nhân',
      description: 'Lịch làm việc của bác sĩ',
    ),
    HospitalNavItem(
      label: 'Dược',
      route: '/pharmacy',
      icon: Icons.medication_rounded,
      group: 'Tra cứu',
      description: 'Danh mục thuốc và đơn vị tính',
    ),
    HospitalNavItem(
      label: 'Xét nghiệm',
      route: '/laboratory',
      icon: Icons.science_rounded,
      group: 'Tra cứu',
      description: 'Kết quả xét nghiệm của bệnh nhân',
    ),
    ai,
    profile,
  ];

  static const List<HospitalNavItem> _patient = [
    home,
    HospitalNavItem(
      label: 'Lịch khám',
      route: '/appointments',
      icon: Icons.calendar_month_rounded,
      group: 'Của tôi',
      description: 'Đặt lịch, theo dõi số thứ tự và hủy lịch',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Hồ sơ sức khỏe',
      route: '/clinical',
      icon: Icons.health_and_safety_rounded,
      group: 'Của tôi',
      description: 'Bệnh án, đơn thuốc và tài liệu y tế',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Kết quả xét nghiệm',
      route: '/laboratory',
      icon: Icons.science_rounded,
      group: 'Của tôi',
      description: 'Xem chi tiết kết quả xét nghiệm',
    ),
    HospitalNavItem(
      label: 'Hóa đơn',
      route: '/billing',
      icon: Icons.receipt_long_rounded,
      group: 'Của tôi',
      description: 'Theo dõi các khoản phí y tế',
    ),
    HospitalNavItem(
      label: 'Bác sĩ',
      route: '/doctors',
      icon: Icons.medical_services_rounded,
      group: 'Tra cứu',
      description: 'Tìm bác sĩ theo chuyên khoa',
    ),
    HospitalNavItem(
      label: 'Khoa',
      route: '/departments',
      icon: Icons.apartment_rounded,
      group: 'Tra cứu',
      description: 'Thông tin các khoa chuyên môn',
    ),
    ai,
    profile,
  ];

  static const List<HospitalNavItem> _staff = [
    home,
    HospitalNavItem(
      label: 'Bệnh nhân',
      route: '/patients',
      icon: Icons.personal_injury_rounded,
      group: 'Tiếp nhận',
      description: 'Đăng ký và cập nhật hồ sơ bệnh nhân',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Lịch khám',
      route: '/appointments',
      icon: Icons.calendar_month_rounded,
      group: 'Tiếp nhận',
      description: 'Theo dõi lịch khám và hàng đợi',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Hồ sơ lâm sàng',
      route: '/clinical',
      icon: Icons.cleaning_services_outlined,
      group: 'Chuyên môn',
      description: 'Ghi nhận sinh hiệu và tài liệu y tế',
      primary: true,
    ),
    HospitalNavItem(
      label: 'Xét nghiệm',
      route: '/laboratory',
      icon: Icons.science_rounded,
      group: 'Chuyên môn',
      description: 'Yêu cầu và phiếu xét nghiệm',
    ),
    HospitalNavItem(
      label: 'Lịch làm việc',
      route: '/schedules',
      icon: Icons.event_available_rounded,
      group: 'Cá nhân',
      description: 'Lịch làm việc của nhân sự',
    ),
    HospitalNavItem(
      label: 'Bác sĩ',
      route: '/doctors',
      icon: Icons.medical_services_rounded,
      group: 'Tra cứu',
      description: 'Danh sách bác sĩ và lịch trực',
    ),
    HospitalNavItem(
      label: 'Khoa',
      route: '/departments',
      icon: Icons.apartment_rounded,
      group: 'Tra cứu',
      description: 'Khoa và phòng khám',
    ),
    HospitalNavItem(
      label: 'Dược',
      route: '/pharmacy',
      icon: Icons.medication_rounded,
      group: 'Tra cứu',
      description: 'Danh mục thuốc',
    ),
    ai,
    profile,
  ];

  static List<HospitalNavItem> forAuth(AuthProvider auth) {
    switch (auth.role) {
      case 'ADMIN':
        return _admin;
      case 'BACSI':
        return _doctor;
      case 'BENHNHAN':
        return _patient;
      case 'NHANSU':
        return _staff;
      default:
        return const [home, profile];
    }
  }

  static List<HospitalNavItem> primaryForAuth(AuthProvider auth) {
    final items = forAuth(auth).where((item) => item.primary).toList();
    if (!items.any((item) => item.route == '/home')) {
      items.insert(0, home);
    }
    if (items.length > 4) {
      return items.take(4).toList();
    }
    return items;
  }

  static String titleForPath(String path, AuthProvider auth) {
    final candidates = forAuth(auth);
    HospitalNavItem? best;
    for (final item in candidates) {
      if (path == item.route || path.startsWith('${item.route}/')) {
        if (best == null || item.route.length > best.route.length) {
          best = item;
        }
      }
    }
    return best?.label ?? 'Hospital P2TB';
  }

  static bool isSelected(String currentPath, String route) {
    return currentPath == route || currentPath.startsWith('$route/');
  }
}
