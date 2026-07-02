import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class PatientBottomNavBar extends StatelessWidget {
  const PatientBottomNavBar({super.key, required this.currentIndex});

  final int currentIndex;

  void _onItemTapped(int index, BuildContext context) {
    if (index == currentIndex) return;

    switch (index) {
      case 0:
        context.go('/patient');
        break;
      case 1:
        context.go('/patient/lich-hen-cua-toi');
        break;
      case 2:
        context.go('/patient/hoso');
        break;
      case 3:
        context.go('/patient/taikhoan');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.bottomNavigationBarTheme.backgroundColor,
        border: Border(top: BorderSide(color: theme.dividerColor)),
      ),
      child: SafeArea(
        top: false,
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) => _onItemTapped(index, context),
          elevation: 0,
          showUnselectedLabels: true,
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined),
              activeIcon: Icon(Icons.home_rounded),
              label: 'Trang chủ',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.calendar_month_outlined),
              activeIcon: Icon(Icons.calendar_month_rounded),
              label: 'Lịch hẹn',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.folder_shared_outlined),
              activeIcon: Icon(Icons.folder_shared_rounded),
              label: 'Hồ sơ',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Cá nhân',
            ),
          ],
        ),
      ),
    );
  }
}
