// lib/screens/doctor/lich_hen_kham_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'doctor_bottom_nav_bar.dart';

// (Model từ file quan_ly_lich_kham_screen.dart)
class LichKhamModel {
  final String maLich;
  final String? tenBN;
  final String? tenBS;
  final String ngayKham;
  final String gioKham;

  LichKhamModel({
    required this.maLich,
    this.tenBN,
    this.tenBS,
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
      tenBS: json['BacSi']?['hoTen'] ?? 'N/A',
      ngayKham: formattedDate,
      gioKham: json['gioKham'] ?? '--:--',
    );
  }
}

class LichHenKhamBSScreen extends StatefulWidget {
  const LichHenKhamBSScreen({super.key});

  @override
  State<LichHenKhamBSScreen> createState() => _LichHenKhamBSScreenState();
}

class _LichHenKhamBSScreenState extends State<LichHenKhamBSScreen> {
  final ApiClient _api = ApiClient();
  List<LichKhamModel> _list = [];
  bool _isLoading = true;
  String? _maBS;

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // Bác sĩ chỉ xem lịch của mình
      final response = await _api.get('/lichkham'); // API gốc lấy tất cả
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data
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
      _showError('Lỗi tải dữ liệu: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Lịch hẹn của Bác sĩ'),
        backgroundColor: Color(0xFF004D40), // SỬA: Màu Bác sĩ
        // SỬA: Bỏ leading, thêm actions
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
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _list.length,
              itemBuilder: (context, index) {
                final item = _list[index];
                return Card(
                  margin: EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.green[100],
                      child: FaIcon(
                        FontAwesomeIcons.calendarCheck,
                        color: Colors.green[800],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      'BN: ${item.tenBN}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Thời gian: ${item.gioKham} - ${item.ngayKham}',
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 2),
    );
  }
}
