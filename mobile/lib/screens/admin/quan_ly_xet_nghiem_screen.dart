// lib/screens/admin/quan_ly_xet_nghiem_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';

// Model
class LoaiXetNghiem {
  final String maLoaiXN;
  final String tenLoai;
  LoaiXetNghiem({required this.maLoaiXN, required this.tenLoai});
  factory LoaiXetNghiem.fromJson(Map<String, dynamic> json) =>
      LoaiXetNghiem(maLoaiXN: json['maLoaiXN'], tenLoai: json['tenLoai']);
}

class XetNghiem {
  final String maXN;
  final String tenXN;
  final String maLoaiXN;
  final double chiPhi;
  final String? thoiGianTraKetQua;
  final String? tenLoai;

  XetNghiem({
    required this.maXN,
    required this.tenXN,
    required this.maLoaiXN,
    required this.chiPhi,
    this.thoiGianTraKetQua,
    this.tenLoai,
  });

  factory XetNghiem.fromJson(Map<String, dynamic> json) {
    return XetNghiem(
      maXN: json['maXN'],
      tenXN: json['tenXN'],
      maLoaiXN: json['maLoaiXN'],
      chiPhi: double.tryParse(json['chiPhi'].toString()) ?? 0.0,
      thoiGianTraKetQua: json['thoiGianTraKetQua'],
      tenLoai: json['LoaiXetNghiem']?['tenLoai'] ?? 'N/A',
    );
  }
}

class QuanLyXetNghiemScreen extends StatefulWidget {
  const QuanLyXetNghiemScreen({super.key});

  @override
  State<QuanLyXetNghiemScreen> createState() => _QuanLyXetNghiemScreenState();
}

class _QuanLyXetNghiemScreenState extends State<QuanLyXetNghiemScreen> {
  final ApiClient _api = ApiClient();
  List<XetNghiem> _list = [];
  List<LoaiXetNghiem> _loaiList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final resXN = await _api.get('/xetnghiem');
      final resLoai = await _api.get('/loaixetnghiem');

      if (resXN.statusCode == 200 && resLoai.statusCode == 200) {
        final dataXN = jsonDecode(resXN.body)['data'] as List;
        final dataLoai = jsonDecode(resLoai.body)['data'] as List;
        setState(() {
          _list = dataXN.map((json) => XetNghiem.fromJson(json)).toList();
          _loaiList = dataLoai
              .map((json) => LoaiXetNghiem.fromJson(json))
              .toList();
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

  Future<void> _handleDelete(String maXN) async {
    final confirm = await _showConfirmDialog(
      'XÃ¡c nháº­n xoÃ¡',
      'Báº¡n cÃ³ cháº¯c muá»‘n xoÃ¡ $maXN?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/xetnghiem/$maXN');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lá»—i: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i: $e');
    }
  }

  Future<void> _showAddEditDialog({XetNghiem? xetNghiem}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = xetNghiem != null;

    String? selectedLoai = isEdit ? xetNghiem.maLoaiXN : null;
    final tenController = TextEditingController(text: xetNghiem?.tenXN);
    final chiPhiController = TextEditingController(
      text: xetNghiem?.chiPhi.toString(),
    );
    final thoiGianController = TextEditingController(
      text: xetNghiem?.thoiGianTraKetQua,
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sá»­a XÃ©t nghiá»‡m' : 'ThÃªm XÃ©t nghiá»‡m'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'Loáº¡i xÃ©t nghiá»‡m',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedLoai,
                    items: _loaiList
                        .map(
                          (loai) => DropdownMenuItem<String>(
                            value: loai.maLoaiXN,
                            child: Text(loai.tenLoai),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedLoai = v,
                    validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: tenController,
                    decoration: InputDecoration(
                      labelText: 'TÃªn xÃ©t nghiá»‡m',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) =>
                        v!.isEmpty ? 'KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: chiPhiController,
                    decoration: InputDecoration(
                      labelText: 'Chi phÃ­',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    validator: (v) =>
                        v!.isEmpty ? 'KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: thoiGianController,
                    decoration: InputDecoration(
                      labelText: 'Thá»i gian tráº£ KQ',
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
              child: Text('Huá»·'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (!formKey.currentState!.validate()) return;

                final payload = {
                  'maLoaiXN': selectedLoai,
                  'tenXN': tenController.text,
                  'chiPhi': chiPhiController.text,
                  'thoiGianTraKetQua': thoiGianController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/xetnghiem/${xetNghiem.maXN}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/xetnghiem', payload);
                  }

                  if (!mounted || !ctx.mounted) return;

                  if (response.statusCode == 200 ||
                      response.statusCode == 201) {
                    Navigator.of(ctx).pop();
                    _fetchData();
                  } else {
                    _showError(
                      'Lá»—i: ${jsonDecode(response.body)['message']}',
                    );
                  }
                } catch (e) {
                  _showError('Lá»—i káº¿t ná»‘i: $e');
                }
              },
              child: Text(isEdit ? 'Cáº­p nháº­t' : 'ThÃªm'),
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
            child: Text('Huá»·'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('XÃ¡c nháº­n', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Quáº£n lÃ½ XÃ©t nghiá»‡m'),
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
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEditDialog(),
        tooltip: 'ThÃªm xÃ©t nghiá»‡m',
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
                      backgroundColor: Colors.brown[100],
                      child: FaIcon(
                        FontAwesomeIcons.vial,
                        color: Colors.brown[600],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      item.tenXN,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'Loáº¡i: ${item.tenLoai} - GiÃ¡: ${item.chiPhi}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.edit,
                            color: Colors.orange[700],
                            size: 20,
                          ),
                          onPressed: () => _showAddEditDialog(xetNghiem: item),
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(item.maXN),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
