// lib/screens/nhansu/yta_home_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import

class YtaHome extends StatelessWidget {
  const YtaHome({super.key});

  @override
  Widget build(BuildContext context) {
    // SỬA: Thêm Scaffold và AppBar
    return Scaffold(
      backgroundColor: Color(0xFFF4F7F6),
      appBar: AppBar(
        title: Text(
          "Y tá Dashboard",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Color(0xFF166534), // Màu xanh Y tá
        elevation: 0,
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/yta'), // Trang chủ Y tá
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'Đăng xuất',
            onPressed: () async {
              await Provider.of<AuthProvider>(context, listen: false).logout();
              if (!context.mounted) return;
              context.go('/login');
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thẻ chào mừng
            _buildWelcomeCard(context),
            SizedBox(height: 24),

            // Lưới chức năng
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              children: [
                _buildDashboardCard(
                  context,
                  icon: FontAwesomeIcons.userPlus,
                  label: "Bệnh nhân đăng ký",
                  color: Colors.blue,
                  onTap: () => context.go('/yta/benhnhan/dangky'),
                ),
                _buildDashboardCard(
                  context,
                  icon: FontAwesomeIcons.stethoscope,
                  label: "Ghi nhận tình trạng",
                  color: Colors.green,
                  onTap: () => context.go('/yta/benhnhan/ghinhantinhtrang'),
                ),
                _buildDashboardCard(
                  context,
                  icon: FontAwesomeIcons.calendarDay,
                  label: "Lịch bác sĩ cùng ca",
                  color: Colors.teal,
                  onTap: () => context.go('/yta/lichlamviec'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // (Các hàm helper cho giao diện)
  Widget _buildWelcomeCard(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(25.0),
      decoration: BoxDecoration(
        color: Color(0xFF166534), // Màu xanh lá cây đậm
        borderRadius: BorderRadius.circular(15.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 10,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          FaIcon(FontAwesomeIcons.userNurse, size: 50, color: Colors.white),
          SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Chào mừng Y tá!",
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  "Giao diện Nhân Sự Y Tế",
                  style: TextStyle(fontSize: 16, color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDashboardCard(
    BuildContext context, {
    required FaIconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 2.0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15.0),
        child: Container(
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(15.0),
            border: Border.all(color: color.withAlpha(70), width: 1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FaIcon(icon, size: 40, color: color), // Sửa: 48 -> 40
              SizedBox(height: 15),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF34495E),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
