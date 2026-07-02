// lib/screens/doctor/doctor_home_screen.dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart'; // Thêm import
import 'dart:convert'; // Thêm import
import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';
import 'doctor_bottom_nav_bar.dart'; // Thêm import

// Model (Lấy từ file lich_hen_kham_bs_screen.dart)
class LichKhamModel {
  final String maLich;
  final String? tenBN;
  final String ngayKham;
  final String gioKham;

  LichKhamModel({
    required this.maLich,
    this.tenBN,
    required this.ngayKham,
    required this.gioKham,
  });

  factory LichKhamModel.fromJson(Map<String, dynamic> json) {
    String formattedDate = json['ngayKham'] ?? '';
    try {
      formattedDate = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayKham']));
    } catch (_) {}

    return LichKhamModel(
      maLich: json['maLich'],
      tenBN: json['BenhNhan']?['hoTen'] ?? 'N/A',
      ngayKham: formattedDate,
      gioKham: json['gioKham'] ?? '--:--',
    );
  }
}
// Kết thúc Model

class DoctorHome extends StatefulWidget {
  const DoctorHome({super.key});

  @override
  State<DoctorHome> createState() => _DoctorHomeState();
}

class _DoctorHomeState extends State<DoctorHome> {
  final ApiClient _api = ApiClient();
  List<LichKhamModel> _lichHenList = [];
  bool _isLoading = true;
  String? _maBS;
  String _tenBS = "Bác sĩ"; // Tên mặc định

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _maBS = auth.maBS;
    // Lấy tên bác sĩ (giả định 'tenDangNhap' là tên hiển thị mong muốn)
    _tenBS = auth.tenDangNhap ?? "Bác sĩ";

    if (_maBS != null) {
      await _fetchLichHen();
    }
    setState(() => _isLoading = false);
  }

  Future<void> _fetchLichHen() async {
    try {
      // Lấy logic từ file lich_hen_kham_bs_screen.dart
      final response = await _api.get('/lichkham');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _lichHenList = data
              .map((json) => LichKhamModel.fromJson(json))
              .where(
                (item) =>
                    jsonDecode(response.body)['data'].firstWhere(
                      (j) => j['maLich'] == item.maLich,
                    )['maBS'] ==
                    _maBS,
              ) // Lọc thủ công
              .toList();
        });
      }
    } catch (e) {
      // Bỏ qua lỗi hiển thị, console sẽ báo
      print('Lỗi tải lịch hẹn: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white, // Nền trắng
      // AppBar giữ nguyên từ file gốc, vì nó dùng cho Drawer
      appBar: AppBar(
        title: Text(
          "Doctor Dashboard",
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        backgroundColor: Color(0xFF004D40), // Màu xanh đậm của Bác sĩ
        elevation: 0,
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/doctor'),
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
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Header tùy chỉnh
              _buildHeader(context, _tenBS, _lichHenList.length),
              SizedBox(height: 16),

              // 2. Ảnh banner
              _buildHeroImage(),
              SizedBox(height: 24),

              // 3. Lưới nút chức năng (sử dụng 6 chức năng cũ)
              _buildButtonGrid(context),
              SizedBox(height: 24),

              // 4. Mục "Lịch hẹn"
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'Lịch hẹn sắp tới',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
              ),
              SizedBox(height: 12),
              _buildLichHenSection(),
              SizedBox(height: 24),
            ],
          ),
        ),
      ),
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 0),
    );
  }

  // Header "Chào mừng" và "Thống kê nhanh"
  Widget _buildHeader(
    BuildContext context,
    String doctorName,
    int appointmentCount,
  ) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Lời chào
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Chào mừng,',
                  style: TextStyle(fontSize: 16, color: Colors.grey[700]),
                ),
                Text(
                  doctorName, // Hiển thị tên BS
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          // Thống kê nhanh
          Container(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: Color(0xFFE0F2F1), // Màu xanh teal nhạt
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  appointmentCount.toString(), // Số lịch hẹn
                  style: TextStyle(
                    color: Color(0xFF004D40),
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
                Text(
                  'Lịch hẹn',
                  style: TextStyle(color: Colors.grey[700], fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // Ảnh banner
  Widget _buildHeroImage() {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16.0),
      height: 150,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(15.0),
        image: DecorationImage(
          // Dùng ảnh placeholder chuyên nghiệp
          image: NetworkImage(
            'https://careplusvn.com/Uploads/t/qu/quy-trinh-kham-benh-va-nhung-dieu-can-luu-y-1_0003335_710.jpeg',
          ),
          fit: BoxFit.cover,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.1),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
    );
  }

  // Lưới nút mới, sắp xếp 2-2-2
  Widget _buildButtonGrid(BuildContext context) {
    final Color secondaryColor = Colors.grey[700]!;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Column(
        children: [
          // Hàng 1 (Nút xanh)
          Row(
            children: [
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.calendarDay,
                  label: "Lịch làm việc",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/lich'),
                ),
              ),
              SizedBox(width: 16),
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.calendarCheck,
                  label: "Lịch hẹn BN",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/lichhen'),
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          // Hàng 2 (Nút trắng)
          Row(
            children: [
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.fileMedical,
                  label: "Phiếu khám bệnh",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/kham'),
                ),
              ),
              SizedBox(width: 16),
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.filePrescription,
                  label: "Kê đơn thuốc",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/kham/donthuoc'),
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          // Hàng 3 (Nút trắng)
          Row(
            children: [
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.vialCircleCheck,
                  label: "Yêu cầu XN",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/xetnghiem'),
                ),
              ),
              SizedBox(width: 16),
              Expanded(
                child: _buildSecondaryButton(
                  context,
                  icon: FontAwesomeIcons.flaskVial,
                  label: "Thông tin cá nhân",
                  color: secondaryColor,
                  onTap: () => context.go('/doctor/taikhoan'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Widget hiển thị danh sách lịch hẹn
  Widget _buildLichHenSection() {
    if (_isLoading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_lichHenList.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Text('Không có lịch hẹn nào sắp tới.'),
        ),
      );
    }

    // Dùng ListView.builder để tạo danh sách
    return ListView.builder(
      itemCount: _lichHenList.length,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      itemBuilder: (context, index) {
        final item = _lichHenList[index];
        return Card(
          margin: EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
          elevation: 1.0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: Colors.green[50],
              child: FaIcon(
                FontAwesomeIcons.userInjured,
                color: Colors.green[800],
                size: 20,
              ),
            ),
            title: Text(
              'BN: ${item.tenBN}',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Text('Thời gian: ${item.gioKham} - ${item.ngayKham}'),
            trailing: Icon(Icons.chevron_right),
            onTap: () {
              // TODO: Chuyển đến trang chi tiết lịch hẹn hoặc phiếu khám
            },
          ),
        );
      },
    );
  }

  // (Các hàm helper cho nút bấm, sao chép từ thiết kế Patient)

  // Hàm helper cho Nút chính (màu xanh)
  // Hàm helper cho Nút phụ (viền trắng/xám)
  Widget _buildSecondaryButton(
    BuildContext context, {
    required FaIconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: Colors.grey[300]!, width: 1.5),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12.0),
        ),
        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          FaIcon(icon, size: 20, color: color),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}
