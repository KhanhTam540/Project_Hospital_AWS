// lib/screens/nhansu/yta_ghi_nhan_tinh_trang_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart'; // Thêm import
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
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

  Future<void> _showEditDialog(HoSoBenhAn hsba) async {
    final formKey = GlobalKey<FormState>();
    final lichSuController = TextEditingController(text: hsba.lichSuBenh);
    final ghiChuController = TextEditingController(text: hsba.ghiChu);

    bool? success = await showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Ghi nhận cho BN: ${hsba.tenBN ?? hsba.maBN}'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: lichSuController,
                  decoration: InputDecoration(
                    labelText: 'Lịch sử bệnh',
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 3,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: ghiChuController,
                  decoration: InputDecoration(
                    labelText: 'Ghi chú (tình trạng, sinh hiệu)',
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
              child: Text('Huỷ'),
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
                    Navigator.of(ctx).pop(true); // Trả về true
                  } else {
                    _showError('Lỗi: ${jsonDecode(response.body)['message']}');
                  }
                } catch (e) {
                  _showError('Lỗi kết nối: $e');
                }
              },
              child: Text('Lưu'),
            ),
          ],
        );
      },
    );

    if (success == true) {
      _fetchData(); // Tải lại danh sách nếu lưu thành công
    }
  }

  @override
  Widget build(BuildContext context) {
    // SỬA: Thêm Scaffold và AppBar
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Ghi nhận tình trạng BN'),
        backgroundColor: Color(0xFF166534), // Màu Y tá
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/yta'),
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
                    subtitle: Text('Lịch sử: ${item.lichSuBenh ?? "Chưa có"}'),
                    trailing: ElevatedButton(
                      child: Text('Ghi nhận'),
                      onPressed: () => _showEditDialog(item),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
