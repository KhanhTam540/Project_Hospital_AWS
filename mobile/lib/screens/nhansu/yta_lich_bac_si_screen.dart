// lib/screens/nhansu/yta_lich_bac_si_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart'; // ThÃªm import
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';

// Model
class LichLamViec {
  final String maLichLV;
  final String? maBS;
  final String? tenBS; // Sáº½ cáº§n join
  final String maCa;
  final String ngayLamViec;

  LichLamViec({
    required this.maLichLV,
    this.maBS,
    this.tenBS,
    required this.maCa,
    required this.ngayLamViec,
  });

  factory LichLamViec.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayLamViec'] ?? '';
    try {
      fNgay = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayLamViec']));
    } catch (_) {}

    return LichLamViec(
      maLichLV: json['maLichLV'],
      maBS: json['maBS'],
      tenBS: json['BacSi']?['hoTen'] ?? 'N/A', // Cáº§n backend join
      maCa: json['maCa'],
      ngayLamViec: fNgay,
    );
  }
}

class LichBacSiYtaScreen extends StatefulWidget {
  const LichBacSiYtaScreen({super.key});

  @override
  State<LichBacSiYtaScreen> createState() => _LichBacSiYtaScreenState();
}

class _LichBacSiYtaScreenState extends State<LichBacSiYtaScreen> {
  final ApiClient _api = ApiClient();
  List<LichLamViec> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // API: GET /api/lichlamviec
      final response = await _api.get('/lichlamviec');
      if (!mounted) return;
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data
              .map((json) => LichLamViec.fromJson(json))
              .where((item) => item.maBS != null) // Chá»‰ lá»c lá»‹ch cá»§a BS
              .toList();
        });
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Lá»—i táº£i dá»¯ liá»‡u: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sá»¬A: ThÃªm Scaffold vÃ  AppBar
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Lá»‹ch BÃ¡c sÄ©'),
        backgroundColor: Color(0xFF166534), // MÃ u Y tÃ¡
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/yta'),
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
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _list.length,
              itemBuilder: (context, index) {
                final item = _list[index];
                return Card(
                  margin: EdgeInsets.only(bottom: 10),
                  elevation: 2,
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.teal[100],
                      child: FaIcon(
                        FontAwesomeIcons.calendarDay,
                        color: Colors.teal[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      'BS: ${item.tenBS} (MÃ£: ${item.maBS})',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'NgÃ y: ${item.ngayLamViec} - Ca: ${item.maCa}',
                    ),
                  ),
                );
              },
            ),
    );
  }
}
