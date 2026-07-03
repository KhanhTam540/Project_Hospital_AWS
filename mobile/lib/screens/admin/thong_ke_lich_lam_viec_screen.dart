// lib/screens/admin/thong_ke_lich_lam_viec_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

// Model
class LichLamViec {
  final String maLichLV;
  final String? maBS;
  final String? maNS;
  final String maCa;
  final DateTime ngayLamViec;

  LichLamViec({
    required this.maLichLV,
    this.maBS,
    this.maNS,
    required this.maCa,
    required this.ngayLamViec,
  });

  factory LichLamViec.fromJson(Map<String, dynamic> json) {
    return LichLamViec(
      maLichLV: json['maLichLV'],
      maBS: json['maBS'],
      maNS: json['maNS'],
      maCa: json['maCa'],
      ngayLamViec: DateTime.parse(json['ngayLamViec']),
    );
  }
}

class ThongKeLichLamViecScreen extends StatefulWidget {
  const ThongKeLichLamViecScreen({super.key});

  @override
  State<ThongKeLichLamViecScreen> createState() =>
      _ThongKeLichLamViecScreenState();
}

class _ThongKeLichLamViecScreenState extends State<ThongKeLichLamViecScreen> {
  final ApiClient _api = ApiClient();
  List<LichLamViec> _allSchedules = [];
  List<LichLamViec> _filteredSchedules = [];
  bool _isLoading = true;

  DateTime _selectedDate = DateTime.now();
  int _soBacSi = 0;
  int _soNhanSu = 0;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final response = await _api.get('/lichlamviec');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _allSchedules = data
              .map((json) => LichLamViec.fromJson(json))
              .toList();
          _filterByWeek(); // Lọc theo tuần hiện tại
        });
      }
    } catch (e) {
      _showError('Lỗi tải dữ liệu: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _filterByWeek() {
    final startOfWeek = _selectedDate.subtract(
      Duration(days: _selectedDate.weekday - 1),
    );
    final endOfWeek = startOfWeek.add(Duration(days: 6));

    final filtered = _allSchedules.where((item) {
      final ngay = item.ngayLamViec;
      return ngay.isAfter(startOfWeek.subtract(Duration(days: 1))) &&
          ngay.isBefore(endOfWeek.add(Duration(days: 1)));
    }).toList();

    final uniqueBS = Set.from(
      filtered.map((item) => item.maBS).where((ma) => ma != null),
    );
    final uniqueNS = Set.from(
      filtered.map((item) => item.maNS).where((ma) => ma != null),
    );

    setState(() {
      _filteredSchedules = filtered;
      _soBacSi = uniqueBS.length;
      _soNhanSu = uniqueNS.length;
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
        title: Text('Thống kê Lịch làm việc'),
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
          _buildStatsCard(),
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator())
                : _buildWeekView(),
          ),
        ],
      ),
    );
  }

  Widget _buildDatePicker(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Chọn ngày trong tuần:', style: TextStyle(fontSize: 16)),
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
                _filterByWeek();
              }
            },
            child: Text(DateFormat('dd/MM/yyyy').format(_selectedDate)),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsCard() {
    final startOfWeek = _selectedDate.subtract(
      Duration(days: _selectedDate.weekday - 1),
    );
    final endOfWeek = startOfWeek.add(Duration(days: 6));

    return Card(
      margin: EdgeInsets.symmetric(horizontal: 16),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Thống kê tuần (${DateFormat('dd/MM').format(startOfWeek)} - ${DateFormat('dd/MM').format(endOfWeek)})',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF34495E),
              ),
            ),
            SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _StatItem(
                  count: _soBacSi,
                  label: 'Bác sĩ',
                  color: Colors.blueAccent,
                ),
                _StatItem(
                  count: _soNhanSu,
                  label: 'Nhân sự',
                  color: Colors.green,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWeekView() {
    final startOfWeek = _selectedDate.subtract(
      Duration(days: _selectedDate.weekday - 1),
    );
    final weekDays = List.generate(
      7,
      (i) => startOfWeek.add(Duration(days: i)),
    );

    return ListView.builder(
      padding: EdgeInsets.all(16),
      itemCount: weekDays.length,
      itemBuilder: (context, index) {
        final day = weekDays[index];
        final items = _filteredSchedules.where((item) {
          return DateFormat('yyyy-MM-dd').format(item.ngayLamViec) ==
              DateFormat('yyyy-MM-dd').format(day);
        }).toList();

        return Card(
          margin: EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  DateFormat('EEE, dd/MM', 'vi_VN').format(day),
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.blue[800],
                  ),
                ),
                Divider(),
                if (items.isEmpty)
                  Center(
                    child: Text(
                      'Không có lịch',
                      style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: Colors.grey,
                      ),
                    ),
                  )
                else
                  ...items.map(
                    (item) => Container(
                      margin: EdgeInsets.only(top: 8),
                      padding: EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: (item.maBS != null
                            ? Colors.blue[50]
                            : Colors.green[50]),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${item.maBS != null ? 'BS: ${item.maBS}' : 'NS: ${item.maNS}'} - Ca: ${item.maCa}',
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StatItem extends StatelessWidget {
  final int count;
  final String label;
  final Color color;

  const _StatItem({
    required this.count,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          count.toString(),
          style: TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(label, style: TextStyle(fontSize: 16, color: Colors.grey[700])),
      ],
    );
  }
}
