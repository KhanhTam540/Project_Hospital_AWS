// lib/screens/nhansu/yta_ghi_nhan_tinh_trang_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart'; // ThÃªm import
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';

// Model
class HoSoBenhAn {
  final String maHSBA;
  final String maBN;
  final String? tenBN;
  final String? lichSuBenh;
  final String? ghiChu;
  final String ngayLap;

  HoSoBenhAn({
    required this.maHSBA,
    required this.maBN,
    this.tenBN,
    this.lichSuBenh,
    this.ghiChu,
    required this.ngayLap,
  });

  factory HoSoBenhAn.fromJson(Map<String, dynamic> json) {
    String fNgayLap = json['ngayLap'] ?? '';
    try {
      fNgayLap = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayLap']));
    } catch (_) {}

    return HoSoBenhAn(
      maHSBA: json['maHSBA'],
      maBN: json['maBN'],
      tenBN: json['BenhNhan']?['hoTen'],
      lichSuBenh: json['lichSuBenh'],
      ghiChu: json['ghiChu'],
      ngayLap: fNgayLap,
    );
  }
}

class GhiNhanTinhTrangScreen extends StatefulWidget {
  const GhiNhanTinhTrangScreen({super.key});

  @override
  State<GhiNhanTinhTrangScreen> createState() => _GhiNhanTinhTrangScreenState();
}

class _GhiNhanTinhTrangScreenState extends State<GhiNhanTinhTrangScreen> {
  final ApiClient _api = ApiClient();
  List<HoSoBenhAn> _list = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // API: GET /api/hsba
      final response = await _api.get('/hsba');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data.map((json) => HoSoBenhAn.fromJson(json)).toList();
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

  Future<void> _showEditDialog(HoSoBenhAn hsba) async {
    final formKey = GlobalKey<FormState>();
    final lichSuController = TextEditingController(text: hsba.lichSuBenh);
    final ghiChuController = TextEditingController(text: hsba.ghiChu);

    bool? success = await showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Ghi nháº­n cho BN: ${hsba.tenBN ?? hsba.maBN}'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: lichSuController,
                  decoration: InputDecoration(
                    labelText: 'Lá»‹ch sá»­ bá»‡nh',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: ghiChuController,
                  decoration: InputDecoration(
                    labelText: 'Ghi chÃº (tÃ¬nh tráº¡ng, sinh hiá»‡u)',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text('Huá»·'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;

                final payload = {
                  'lichSuBenh': lichSuController.text,
                  'ghiChu': ghiChuController.text,
                };

                try {
                  // API: PUT /api/hsba/:id
                  final response = await _api.put(
                    '/hsba/${hsba.maHSBA}',
                    payload,
                  );
                  if (!mounted || !ctx.mounted) return;
                  if (response.statusCode == 200) {
                    Navigator.of(ctx).pop(true); // Tráº£ vá» true
                  } else {
                    _showError(
                      'Lá»—i: ${jsonDecode(response.body)['message']}',
                    );
                  }
                } catch (e) {
                  _showError('Lá»—i káº¿t ná»‘i: $e');
                }
              },
              child: Text('LÆ°u'),
            ),
          ],
        );
      },
    );

    if (success == true) {
      _fetchData(); // Táº£i láº¡i danh sÃ¡ch náº¿u lÆ°u thÃ nh cÃ´ng
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sá»¬A: ThÃªm Scaffold vÃ  AppBar
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Ghi nháº­n tÃ¬nh tráº¡ng BN'),
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
                      backgroundColor: Colors.green[100],
                      child: FaIcon(
                        FontAwesomeIcons.stethoscope,
                        color: Colors.green[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      'BN: ${item.tenBN ?? item.maBN}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Lá»‹ch sá»­: ${item.lichSuBenh ?? "ChÆ°a cÃ³"}',
                    ),
                    trailing: ElevatedButton(
                      child: Text('Ghi nháº­n'),
                      onPressed: () => _showEditDialog(item),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
