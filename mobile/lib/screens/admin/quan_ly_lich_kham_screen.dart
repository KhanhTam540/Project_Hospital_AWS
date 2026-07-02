// lib/screens/admin/quan_ly_lich_kham_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

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

class QuanLyLichKhamScreen extends StatefulWidget {
  const QuanLyLichKhamScreen({super.key});

  @override
  State<QuanLyLichKhamScreen> createState() => _QuanLyLichKhamScreenState();
}

class _QuanLyLichKhamScreenState extends State<QuanLyLichKhamScreen> {
  final ApiClient _api = ApiClient();
  List<LichKhamModel> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final response = await _api.get('/lichkham');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data.map((json) => LichKhamModel.fromJson(json)).toList();
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

  Future<void> _handleDelete(String maLich) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá lịch $maLich?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/lichkham/$maLich');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  // Dialog xác nhận
  Future<bool?> _showConfirmDialog(String title, String content) {
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Huỷ'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Xác nhận', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Quản lý Lịch khám'),
        backgroundColor: Color(0xFF2C3E50),
        // SỬA: Bỏ 'leading' và thêm 'actions'
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/admin'),
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
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // TODO: Mở dialog/trang tạo lịch khám mới
          // Sẽ cần tải DS Bác sĩ và Bệnh nhân
        },
        tooltip: 'Thêm lịch khám',
        child: Icon(Icons.add),
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
                      backgroundColor: Colors.lightGreen[100],
                      child: FaIcon(
                        FontAwesomeIcons.calendarCheck,
                        color: Colors.lightGreen[800],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      'BS: ${item.tenBS} - BN: ${item.tenBN}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Thời gian: ${item.gioKham} - ${item.ngayKham}',
                    ),
                    trailing: IconButton(
                      icon: Icon(
                        Icons.delete,
                        color: Colors.red[700],
                        size: 20,
                      ),
                      onPressed: () => _handleDelete(item.maLich),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
