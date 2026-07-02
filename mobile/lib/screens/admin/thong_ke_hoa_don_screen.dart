// lib/screens/admin/thong_ke_hoa_don_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
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
    _fetchStats(); // Táº£i thá»‘ng kÃª cho ngÃ y hÃ´m nay
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
      _showError('Lá»—i táº£i dá»¯ liá»‡u: $e');
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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Thá»‘ng kÃª HÃ³a Ä‘Æ¡n'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        // Sá»¬A: Bá» 'leading' vÃ  thÃªm 'actions'
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/admin'),
          ),
          IconButton(
            icon: FaIcon(
              FontAwesomeIcons.rightFromBracket,
              color: Colors.white,
              size: 20,
            ),
            tooltip: 'ÄÄƒng xuáº¥t',
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
                ? Center(child: Text('KhÃ´ng cÃ³ dá»¯ liá»‡u.'))
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
                  'Tá»« ngÃ y',
                  _fromDate,
                  (date) => setState(() => _fromDate = date),
                ),
                _buildDateField(
                  context,
                  'Äáº¿n ngÃ y',
                  _toDate,
                  (date) => setState(() => _toDate = date),
                ),
              ],
            ),
            SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _fetchStats,
              icon: Icon(Icons.filter_list),
              label: Text('Lá»c'),
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
    final formatCurrency = NumberFormat.currency(locale: 'vi_VN', symbol: 'Ä‘');

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      children: [
        _buildStatCard(
          'Tá»•ng Doanh thu',
          formatCurrency.format(_stats!['tongTien'] ?? 0),
          FontAwesomeIcons.fileInvoiceDollar,
          Colors.brown,
        ),
        _buildStatCard(
          'Tá»•ng sá»‘ HÄ',
          (_stats!['tongSo'] ?? 0).toString(),
          FontAwesomeIcons.fileLines,
          Colors.blueGrey,
        ),
        _buildStatCard(
          'ÄÃ£ thanh toÃ¡n',
          (_stats!['daThanhToan'] ?? 0).toString(),
          FontAwesomeIcons.circleCheck,
          Colors.green,
        ),
        _buildStatCard(
          'ChÆ°a thanh toÃ¡n',
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
