// lib/screens/admin/quan_ly_ho_so_benh_an_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart'; // Thêm import
import '../../auth/auth_provider.dart'; // Thêm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // Dùng UserModel để lấy DS Bệnh nhân

// Model
class HoSoBenhAnModel {
  final String maHSBA;
  final String maBN;
  final String? tenBN;
  final String ngayLap;
  final String dotKhamBenh;

  HoSoBenhAnModel({
    required this.maHSBA,
    required this.maBN,
    this.tenBN,
    required this.ngayLap,
    required this.dotKhamBenh,
  });

  factory HoSoBenhAnModel.fromJson(Map<String, dynamic> json) {
    String fNgayLap = json['ngayLap'] ?? '';
    String fDotKham = json['dotKhamBenh'] ?? '';
    try {
      fNgayLap = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayLap']));
      fDotKham = DateFormat(
        'dd/MM/yyyy HH:mm',
      ).format(DateTime.parse(json['dotKhamBenh']));
    } catch (_) {}

    return HoSoBenhAnModel(
      maHSBA: json['maHSBA'],
      maBN: json['maBN'],
      tenBN: json['BenhNhan']?['hoTen'] ?? 'N/A',
      ngayLap: fNgayLap,
      dotKhamBenh: fDotKham,
    );
  }
}

class QuanLyHoSoBenhAnScreen extends StatefulWidget {
  const QuanLyHoSoBenhAnScreen({super.key});

  @override
  State<QuanLyHoSoBenhAnScreen> createState() => _QuanLyHoSoBenhAnScreenState();
}

class _QuanLyHoSoBenhAnScreenState extends State<QuanLyHoSoBenhAnScreen> {
  final ApiClient _api = ApiClient();
  List<HoSoBenhAnModel> _list = [];
  List<UserModel> _benhNhanList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final resHSBA = await _api.get('/hsba');
      final resBN = await _api.get('/benhnhan');

      if (resHSBA.statusCode == 200 && resBN.statusCode == 200) {
        final dataHSBA = jsonDecode(resHSBA.body)['data'] as List;
        final dataBN = jsonDecode(resBN.body)['data'] as List;
        setState(() {
          _list = dataHSBA
              .map((json) => HoSoBenhAnModel.fromJson(json))
              .toList();
          _benhNhanList = dataBN
              .map((json) => UserModel.fromJson(json))
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

  Future<void> _handleDelete(String maHSBA) async {
    final confirm = await _showConfirmDialog(
      'Xác nhận xoá',
      'Bạn có chắc muốn xoá HSBA $maHSBA?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/hsba/$maHSBA');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lỗi: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    }
  }

  Future<void> _showAddDialog() async {
    final formKey = GlobalKey<FormState>();
    String? selectedBN;
    final dotKhamController = TextEditingController(
      text: DateFormat("yyyy-MM-dd'T'HH:mm").format(DateTime.now()),
    );
    final lichSuController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text('Thêm Hồ sơ Bệnh án'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Chọn Bệnh nhân',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedBN,
                    items: _benhNhanList
                        .map(
                          (bn) => DropdownMenuItem<String>(
                            value: bn.maBN,
                            child: Text(bn.hoTen ?? bn.tenDangNhap),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedBN = v,
                    validator: (v) => v == null ? 'Vui lòng chọn' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: dotKhamController,
                    decoration: InputDecoration(
                      labelText: 'Đợt khám (YYYY-MM-DDTHH:mm)',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => v!.isEmpty ? 'Không được bỏ trống' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: lichSuController,
                    decoration: InputDecoration(
                      labelText: 'Lịch sử bệnh',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text('Huỷ'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;

                final payload = {
                  'maBN': selectedBN,
                  'dotKhamBenh': dotKhamController.text,
                  'lichSuBenh': lichSuController.text,
                };

                try {
                  final response = await _api.post('/hsba', payload);
                  if (!mounted || !ctx.mounted) return;
                  if (response.statusCode == 201) {
                    Navigator.of(ctx).pop();
                    _fetchData();
                  } else {
                    _showError('Lỗi: ${jsonDecode(response.body)['message']}');
                  }
                } catch (e) {
                  _showError('Lỗi kết nối: $e');
                }
              },
              child: Text('Thêm'),
            ),
          ],
        );
      },
    );
  }

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
        title: Text('Quản lý Hồ sơ Bệnh án'),
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
        onPressed: () => _showAddDialog(),
        tooltip: 'Thêm hồ sơ',
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
                      backgroundColor: Colors.pink[100],
                      child: FaIcon(
                        FontAwesomeIcons.fileMedical,
                        color: Colors.pink[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      'BN: ${item.tenBN}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Mã HSBA: ${item.maHSBA}\nĐợt khám: ${item.dotKhamBenh}',
                    ),
                    trailing: IconButton(
                      icon: Icon(
                        Icons.delete,
                        color: Colors.red[700],
                        size: 20,
                      ),
                      onPressed: () => _handleDelete(item.maHSBA),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
