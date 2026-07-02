import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_provider.dart';

class XetNghiemHome extends StatelessWidget {
  // Định nghĩa các nút chức năng
  final List<Map<String, dynamic>> _menuItems = const [
    {
      'label': 'Xử lý Yêu cầu Xét nghiệm',
      'icon': FontAwesomeIcons.vialCircleCheck,
      'color': Color(0xFF6366F1), // Màu xanh tím
      'route': '/xetnghiem/xetnghiem/yeucau',
    },
    {
      'label': 'Lập Phiếu Xét nghiệm',
      'icon': FontAwesomeIcons.fileSignature,
      'color': Color(0xFF0D9488), // Màu xanh ngọc
      'route': '/xetnghiem/xetnghiem/phieu',
    },
  ];

  const XetNghiemHome({super.key});

  @override
  Widget build(BuildContext context) {
    final Color appBarColor = Colors.indigo[700]!; // Màu Xét Nghiệm (đã đổi)

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text("Trang Xét Nghiệm"),
        backgroundColor: appBarColor,
        elevation: 0,
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/xetnghiem'),
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
            // Thẻ chào mừng (Header)
            _buildWelcomeCard(context, appBarColor),
            SizedBox(height: 24),

            // Lưới chức năng
            Text(
              "QUẢN LÝ XÉT NGHIỆM",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Colors.indigo[800],
              ),
            ),
            SizedBox(height: 16),
            GridView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.2, // Tăng chiều cao thẻ
              ),
              itemCount: _menuItems.length,
              itemBuilder: (context, index) {
                final item = _menuItems[index];
                return _buildDashboardCard(
                  context,
                  icon: item['icon'] as FaIconData,
                  label: item['label'] as String,
                  color: item['color'] as Color,
                  onTap: () => context.go(item['route'] as String),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  // --- WIDGET HELPER ---

  Widget _buildWelcomeCard(BuildContext context, Color color) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final String hoTen = auth.tenDangNhap ?? "Nhân viên";

    return Container(
      padding: EdgeInsets.all(20.0),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(15.0),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            spreadRadius: 2,
            blurRadius: 8,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          FaIcon(FontAwesomeIcons.flaskVial, size: 40, color: Colors.white),
          SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Xin chào, $hoTen!",
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  "Sẵn sàng xử lý mẫu xét nghiệm.",
                  style: TextStyle(fontSize: 14, color: Colors.white70),
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
      elevation: 3.0,
      shadowColor: color.withAlpha(50),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15.0)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15.0),
        child: Container(
          padding: EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withAlpha(20), // Nền màu nhạt
            borderRadius: BorderRadius.circular(15.0),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FaIcon(icon, size: 36, color: color),
              SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Colors.black87,
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
