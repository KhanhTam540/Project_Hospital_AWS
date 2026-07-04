import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_provider.dart';

class AdminHome extends StatelessWidget {
  const AdminHome({super.key});

  @override
  Widget build(BuildContext context) {
    final Color primaryColor = Color(0xFF2C3E50);
    final Color secondaryColor = Color(0xFF34495E);
    final Color backgroundColor = Color(0xFFF4F7F6);

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: Text(
          "Admin Dashboard",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        backgroundColor: primaryColor,
        elevation: 0,
        // Nút mở Drawer (3 gạch) sẽ tự động xuất hiện

        // THÊM NÚT ĐĂNG XUẤT
        actions: [
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
            _buildWelcomeCard(color1: primaryColor, color2: secondaryColor),
            SizedBox(height: 20),
            _buildFunctionSection(
              context: context,
              title: "TÀI KHOẢN & PHÂN QUYỀN",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.users,
                  label: "Danh sách tài khoản",
                  color: Colors.blue,
                  onTap: () => context.go('/admin/account/list'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.userPlus,
                  label: "Tạo tài khoản",
                  color: Colors.green,
                  onTap: () => context.go('/admin/account/create'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.shieldHalved,
                  label: "Phân quyền",
                  color: Colors.orange,
                  onTap: () => context.go('/admin/account/roles'),
                ),
              ],
            ),

            _buildFunctionSection(
              context: context,
              title: "NHÂN SỰ",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.userSecret,
                  label: "Trợ lý bác sĩ",
                  color: Colors.teal,
                  onTap: () => context.go('/admin/specialty/e'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.userNurse, // Sửa icon
                  label: "Nhân viên y tế",
                  color: Colors.cyan,
                  onTap: () => context.go('/admin/specialty/d'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.userDoctor,
                  label: "Bác sĩ",
                  color: Colors.blueAccent,
                  onTap: () => context.go('/admin/specialty/b'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.clock,
                  label: "Quản lý ca trực",
                  color: Colors.indigo,
                  onTap: () => context.go('/admin/specialty/dept'),
                ),
              ],
            ),

            _buildFunctionSection(
              context: context,
              title: "CHUYÊN MÔN",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.hospital,
                  label: "Quản lý khoa",
                  color: Colors.green[700]!,
                  onTap: () => context.go('/admin/specialty/c'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.calendarCheck,
                  label: "Lịch khám",
                  color: Colors.lightGreen[800]!,
                  onTap: () => context.go('/admin/specialty/f'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.vial,
                  label: "Xét nghiệm",
                  color: Colors.lime[900]!,
                  onTap: () => context.go('/admin/specialty/h'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.vials,
                  label: "Loại xét nghiệm",
                  color: Colors.deepOrange[800]!,
                  onTap: () => context.go('/admin/specialty/g'),
                ),
              ],
            ),

            _buildFunctionSection(
              context: context,
              title: "BỆNH NHÂN",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.users,
                  label: "Quản lý bệnh nhân",
                  color: Colors.red[700]!,
                  onTap: () => context.go('/admin/specialty/j'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.fileMedical,
                  label: "Hồ sơ bệnh án",
                  color: Colors.pink[700]!,
                  onTap: () => context.go('/admin/specialty/m'),
                ),
              ],
            ),

            _buildFunctionSection(
              context: context,
              title: "THUỐC & ĐƠN VỊ",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.capsules,
                  label: "Quản lý thuốc",
                  color: Colors.purple,
                  onTap: () => context.go('/admin/specialty/o'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.tags,
                  label: "Nhóm thuốc",
                  color: Colors.deepPurple,
                  onTap: () => context.go('/admin/specialty/n'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.box,
                  label: "Đơn vị tính",
                  color: Colors.indigo,
                  onTap: () => context.go('/admin/specialty/p'),
                ),
              ],
            ),

            _buildFunctionSection(
              context: context,
              title: "HÓA ĐƠN & THỐNG KÊ",
              items: [
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.fileInvoiceDollar,
                  label: "Thống kê hóa đơn",
                  color: Colors.brown,
                  onTap: () => context.go('/admin/specialty/k'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.calendarDays,
                  label: "Thống kê lịch làm việc",
                  color: Colors.blueGrey,
                  onTap: () => context.go('/admin/specialty/v'),
                ),
                _buildDashboardCard(
                  context: context,
                  icon: FontAwesomeIcons.chartPie,
                  label: "Thống kê lịch khám",
                  color: Colors.black,
                  onTap: () => context.go('/admin/specialty/l'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeCard({required Color color1, required Color color2}) {
    return Container(
      padding: EdgeInsets.all(25.0),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [color1, color2],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(15.0),
        boxShadow: [
          BoxShadow(
            color: color1.withAlpha((255 * 0.3).round()),
            spreadRadius: 2,
            blurRadius: 10,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        children: [
          FaIcon(FontAwesomeIcons.userShield, size: 45, color: Colors.white),
          SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Chào mừng Admin!",
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  "Quản lý hệ thống bệnh viện.",
                  style: TextStyle(fontSize: 16, color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFunctionSection({
    required BuildContext context,
    required String title,
    required List<Widget> items,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF34495E),
          ),
        ),
        SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          shrinkWrap: true,
          physics: NeverScrollableScrollPhysics(),
          children: items,
        ),
        SizedBox(height: 24), // Khoảng cách giữa các nhóm
      ],
    );
  }

  Widget _buildDashboardCard({
    required BuildContext context,
    required FaIconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 3.0,
      shadowColor: color.withAlpha((255 * 0.3).round()),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15.0),
        child: Container(
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withAlpha((255 * 0.05).round()), // Nền màu nhạt
            borderRadius: BorderRadius.circular(15.0),
            border: Border.all(
              color: color.withAlpha((255 * 0.3).round()),
              width: 1,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FaIcon(icon, size: 40, color: color), // Dùng FaIcon
              SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF34495E),
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
