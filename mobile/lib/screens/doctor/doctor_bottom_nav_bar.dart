// lib/screens/patient/layouts/patient_bottom_nav_bar.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class DoctorBottomNavBar extends StatelessWidget {
  final int currentIndex;

  const DoctorBottomNavBar({super.key, required this.currentIndex});

  void _onItemTapped(int index, BuildContext context) {
    // Không điều hướng nếu đã ở trang hiện tại
    if (index == currentIndex) return;

    switch (index) {
      case 0: // Trang chủ
        context.go('/doctor');
        break;
      case 1: // Lịch làm việc
        context.go('/doctor/lich');
        break;
      case 2: // Lịch hẹn bệnh nhân
        context.go('/doctor/lichhen');
        break;
      case 3: // Phiếu khám bệnh
        context.go('/doctor/kham');
        break;
      case 4: // Phiếu khám bệnh
        context.go('/doctor/taikhoan');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return BottomNavigationBar(
      items: const <BottomNavigationBarItem>[
        BottomNavigationBarItem(
          icon: Icon(Icons.home_outlined),
          activeIcon: Icon(Icons.home), // Icon khi được chọn
          label: 'Trang chủ',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.calendar_month_outlined),
          activeIcon: Icon(Icons.calendar_month),
          label: 'Lịch làm việc',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.account_balance_wallet_rounded),
          activeIcon: Icon(Icons.account_balance_wallet),
          label: 'Lịch hẹn bệnh nhân',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          activeIcon: Icon(Icons.person),
          label: 'Phiếu khám bệnh',
        ),
        BottomNavigationBarItem(
          icon: Icon(Icons.person_outline),
          activeIcon: Icon(Icons.person),
          label: 'Cá nhân',
        ),
      ],
      currentIndex: currentIndex,
      selectedItemColor: Color(0xFF0D6EFD), // Màu xanh dương (giống ảnh)
      unselectedItemColor: Colors.grey[600],
      onTap: (index) => _onItemTapped(index, context),
      type: BottomNavigationBarType.fixed, // Luôn hiển thị label
      showUnselectedLabels: true,
      backgroundColor: Colors.white,
      elevation: 8.0,
    );
  }
}
