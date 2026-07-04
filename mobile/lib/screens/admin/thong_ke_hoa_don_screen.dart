// lib/screens/admin/thong_ke_hoa_don_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';

class ThongKeHoaDonScreen extends StatefulWidget {
  const ThongKeHoaDonScreen({super.key});

  @override
  State<ThongKeHoaDonScreen> createState() => _ThongKeHoaDonScreenState();
}

class _ThongKeHoaDonScreenState extends State<ThongKeHoaDonScreen> {
  final ApiClient _api = ApiClient();
  DateTime _fromDate = DateTime.now();
  DateTime _toDate = DateTime.now();
  Map<String, dynamic>? _stats;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _fetchStats(); // Tải thống kê cho ngày hôm nay
  }

  Future<void> _fetchStats() async {
    setState(() => _isLoading = true);
    final String from = DateFormat('yyyy-MM-dd').format(_fromDate);
    final String to = DateFormat('yyyy-MM-dd').format(_toDate);

    try {
      final response = await _api.get('/hoadon/thongke?from=$from&to=$to');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'];
        setState(() {
          _stats = data;
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
        title: Text('Thống kê Hóa đơn'),
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
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            _buildDatePicker(),
            SizedBox(height: 20),
            _isLoading
                ? Center(child: CircularProgressIndicator())
                : _stats == null
                ? Center(child: Text('Không có dữ liệu.'))
                : _buildStatsGrid(),
          ],
        ),
      ),
    );
  }

  Widget _buildDatePicker() {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildDateField(
                  context,
                  'Từ ngày',
                  _fromDate,
                  (date) => setState(() => _fromDate = date),
                ),
                _buildDateField(
                  context,
                  'Đến ngày',
                  _toDate,
                  (date) => setState(() => _toDate = date),
                ),
              ],
            ),
            SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchStats,
              icon: Icon(Icons.filter_list),
              label: Text('Lọc'),
              style: ElevatedButton.styleFrom(
                minimumSize: Size(double.infinity, 44),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateField(
    BuildContext context,
    String label,
    DateTime date,
    Function(DateTime) onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
        ),
        SizedBox(height: 8),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
          ),
          onPressed: () async {
            DateTime? picked = await showDatePicker(
              context: context,
              initialDate: date,
              firstDate: DateTime(2020),
              lastDate: DateTime.now(),
            );
            if (picked != null && picked != date) onChanged(picked);
          },
          child: Text(DateFormat('dd/MM/yyyy').format(date)),
        ),
      ],
    );
  }

  Widget _buildStatsGrid() {
    final formatCurrency = NumberFormat.currency(locale: 'vi_VN', symbol: 'đ');

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      children: [
        _buildStatCard(
          'Tổng Doanh thu',
          formatCurrency.format(_stats!['tongTien'] ?? 0),
          FontAwesomeIcons.fileInvoiceDollar,
          Colors.brown,
        ),
        _buildStatCard(
          'Tổng số HĐ',
          (_stats!['tongSo'] ?? 0).toString(),
          FontAwesomeIcons.fileLines,
          Colors.blueGrey,
        ),
        _buildStatCard(
          'Đã thanh toán',
          (_stats!['daThanhToan'] ?? 0).toString(),
          FontAwesomeIcons.circleCheck,
          Colors.green,
        ),
        _buildStatCard(
          'Chưa thanh toán',
          (_stats!['chuaThanhToan'] ?? 0).toString(),
          FontAwesomeIcons.circleXmark,
          Colors.red,
        ),
      ],
    );
  }

  Widget _buildStatCard(
    String title,
    String value,
    FaIconData icon,
    Color color,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            FaIcon(icon, size: 30, color: color),
            SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                color: Colors.grey[600],
                fontSize: 15,
                fontWeight: FontWeight.w500,
              ),
            ),
            SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: Colors.black,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
