// lib/screens/admin/thong_ke_lich_kham_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

class ThongKeLichKhamScreen extends StatefulWidget {
  const ThongKeLichKhamScreen({super.key});

  @override
  State<ThongKeLichKhamScreen> createState() => _ThongKeLichKhamScreenState();
}

class _ThongKeLichKhamScreenState extends State<ThongKeLichKhamScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _allSchedules = [];
  bool _isLoading = true;

  DateTime _selectedDate = DateTime.now();
  int _tongLich = 0;
  int _soBacSi = 0;
  int _soBenhNhan = 0;

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
          _allSchedules = data.cast<Map<String, dynamic>>();
          _filterByDay(); // Lọc theo ngày hôm nay
        });
      }
    } catch (e) {
      _showError('Lỗi tải dữ liệu: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _filterByDay() {
    final selectedDayString = DateFormat('yyyy-MM-dd').format(_selectedDate);

    final filtered = _allSchedules.where((item) {
      final ngay = item['ngayKham']?.toString().split('T').first;
      return ngay == selectedDayString;
    }).toList();

    final uniqueBS = Set.from(filtered.map((item) => item['maBS']));
    final uniqueBN = Set.from(filtered.map((item) => item['maBN']));

    setState(() {
      _tongLich = filtered.length;
      _soBacSi = uniqueBS.length;
      _soBenhNhan = uniqueBN.length;
    });
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
        title: Text('Thống kê Lịch khám'),
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
      body: Column(
        children: [
          _buildDatePicker(context),
          SizedBox(height: 20),
          _isLoading
              ? Center(child: CircularProgressIndicator())
              : _buildStatsCard(),
        ],
      ),
    );
  }

  Widget _buildDatePicker(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Card(
        elevation: 2,
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Chọn ngày thống kê:', style: TextStyle(fontSize: 16)),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                    ),
                    onPressed: () async {
                      DateTime? picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate,
                        firstDate: DateTime(2020),
                        lastDate: DateTime.now().add(Duration(days: 365)),
                      );
                      if (picked != null && picked != _selectedDate) {
                        setState(() => _selectedDate = picked);
                      }
                    },
                    child: Text(DateFormat('dd/MM/yyyy').format(_selectedDate)),
                  ),
                ],
              ),
              SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _filterByDay,
                icon: Icon(Icons.filter_list),
                label: Text('Thống kê'),
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 44),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatsCard() {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: 16),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Kết quả ngày: ${DateFormat('dd/MM/yyyy').format(_selectedDate)}',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF34495E),
              ),
            ),
            SizedBox(height: 16),
            _StatItem(
              icon: FontAwesomeIcons.calendarCheck,
              count: _tongLich,
              label: 'Tổng số lịch khám',
              color: Colors.blue,
            ),
            Divider(height: 24),
            _StatItem(
              icon: FontAwesomeIcons.userDoctor,
              count: _soBacSi,
              label: 'Số bác sĩ tham gia',
              color: Colors.green,
            ),
            Divider(height: 24),
            _StatItem(
              icon: FontAwesomeIcons.userInjured,
              count: _soBenhNhan,
              label: 'Số bệnh nhân',
              color: Colors.red,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final int count;
  final String label;
  final Color color;
  final FaIconData icon;

  const _StatItem({
    required this.count,
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        FaIcon(icon, size: 24, color: color),
        SizedBox(width: 16),
        Text(label, style: TextStyle(fontSize: 16, color: Colors.grey[700])),
        Spacer(),
        Text(
          count.toString(),
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }
}
