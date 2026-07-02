// lib/screens/admin/quan_ly_thuoc_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';
import 'package:intl/intl.dart';

// Models
class NhomThuoc {
  final String maNhom;
  final String tenNhom;
  NhomThuoc({required this.maNhom, required this.tenNhom});
  factory NhomThuoc.fromJson(Map<String, dynamic> json) =>
      NhomThuoc(maNhom: json['maNhom'], tenNhom: json['tenNhom']);
}

class DonViTinh {
  final String maDVT;
  final String tenDVT;
  DonViTinh({required this.maDVT, required this.tenDVT});
  factory DonViTinh.fromJson(Map<String, dynamic> json) =>
      DonViTinh(maDVT: json['maDVT'], tenDVT: json['tenDVT']);
}

class Thuoc {
  final String maThuoc;
  final String tenThuoc;
  final String? tenNhom;
  final String? tenDVT;
  final int tonKho;

  Thuoc({
    required this.maThuoc,
    required this.tenThuoc,
    this.tenNhom,
    this.tenDVT,
    required this.tonKho,
  });

  factory Thuoc.fromJson(Map<String, dynamic> json) {
    return Thuoc(
      maThuoc: json['maThuoc'],
      tenThuoc: json['tenThuoc'],
      tenNhom: json['NhomThuoc']?['tenNhom'] ?? 'N/A',
      tenDVT: json['DonViTinh']?['tenDVT'] ?? 'N/A',
      tonKho: json['tonKhoHienTai'] ?? 0,
    );
  }
}

class QuanLyThuocScreen extends StatefulWidget {
  const QuanLyThuocScreen({super.key});

  @override
  State<QuanLyThuocScreen> createState() => _QuanLyThuocScreenState();
}

class _QuanLyThuocScreenState extends State<QuanLyThuocScreen> {
  final ApiClient _api = ApiClient();
  List<Thuoc> _list = [];
  List<NhomThuoc> _nhomList = [];
  List<DonViTinh> _dvtList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final resThuoc = await _api.get('/thuoc');
      final resNhom = await _api.get('/thuoc/nhomthuoc');
      final resDVT = await _api.get('/thuoc/donvitinh');

      if (resThuoc.statusCode == 200 &&
          resNhom.statusCode == 200 &&
          resDVT.statusCode == 200) {
        final dataThuoc = jsonDecode(resThuoc.body)['data'] as List;
        final dataNhom = jsonDecode(resNhom.body)['data'] as List;
        final dataDVT = jsonDecode(resDVT.body)['data'] as List;

        setState(() {
          _list = dataThuoc.map((json) => Thuoc.fromJson(json)).toList();
          _nhomList = dataNhom.map((json) => NhomThuoc.fromJson(json)).toList();
          _dvtList = dataDVT.map((json) => DonViTinh.fromJson(json)).toList();
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

  Future<void> _handleDelete(String maThuoc) async {
    final confirm = await _showConfirmDialog(
      'XÃ¡c nháº­n xoÃ¡',
      'Báº¡n cÃ³ cháº¯c muá»‘n xoÃ¡ $maThuoc?',
    );
    if (confirm != true) return;
    try {
      final response = await _api.delete('/thuoc/$maThuoc');
      if (response.statusCode == 200) {
        _fetchData();
      } else {
        _showError('Lá»—i: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i: $e');
    }
  }

  // Dialog ThÃªm/Sá»­a (PhiÃªn báº£n rÃºt gá»n, cÃ³ thá»ƒ thÃªm trÆ°á»ng náº¿u cáº§n)
  Future<void> _showAddEditDialog({Thuoc? thuoc}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = thuoc != null;

    // (ÄÃ¢y lÃ  phiÃªn báº£n rÃºt gá»n, backend /thuoc/controller.js cáº§n nhiá»u trÆ°á»ng hÆ¡n)
    final tenController = TextEditingController(
      text: isEdit ? thuoc.tenThuoc : '',
    );
    String? selectedNhom = isEdit
        ? _nhomList
              .firstWhere(
                (n) => n.tenNhom == thuoc.tenNhom,
                orElse: () => _nhomList.first,
              )
              .maNhom
        : null;
    String? selectedDVT = isEdit
        ? _dvtList
              .firstWhere(
                (d) => d.tenDVT == thuoc.tenDVT,
                orElse: () => _dvtList.first,
              )
              .maDVT
        : null;
    final hoatChatController = TextEditingController(
      text: isEdit ? '' : '',
    ); // Cáº§n thÃªm logic láº¥y chi tiáº¿t
    final giaBanController = TextEditingController(text: isEdit ? '' : '');
    final tonKhoController = TextEditingController(
      text: isEdit ? thuoc.tonKho.toString() : '0',
    );

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sá»­a Thuá»‘c' : 'ThÃªm Thuá»‘c'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: tenController,
                    decoration: InputDecoration(labelText: 'TÃªn thuá»‘c'),
                    validator: (v) => v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: hoatChatController,
                    decoration: InputDecoration(labelText: 'Hoáº¡t cháº¥t'),
                    validator: (v) => v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
                  ),
                  SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'NhÃ³m thuá»‘c',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedNhom,
                    items: _nhomList
                        .map(
                          (nhom) => DropdownMenuItem<String>(
                            value: nhom.maNhom,
                            child: Text(nhom.tenNhom),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedNhom = v,
                    validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                  ),
                  SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      labelText: 'ÄÆ¡n vá»‹ tÃ­nh',
                      border: OutlineInputBorder(),
                    ),
                    initialValue: selectedDVT,
                    items: _dvtList
                        .map(
                          (dvt) => DropdownMenuItem<String>(
                            value: dvt.maDVT,
                            child: Text(dvt.tenDVT),
                          ),
                        )
                        .toList(),
                    onChanged: (v) => selectedDVT = v,
                    validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: giaBanController,
                    decoration: InputDecoration(labelText: 'GiÃ¡ bÃ¡n láº»'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
                  ),
                  SizedBox(height: 16),
                  TextFormField(
                    controller: tonKhoController,
                    decoration: InputDecoration(labelText: 'Tá»“n kho'),
                    keyboardType: TextInputType.number,
                    validator: (v) => v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
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

                // Backend yÃªu cáº§u ráº¥t nhiá»u trÆ°á»ng, Ä‘Ã¢y lÃ  cÃ¡c trÆ°á»ng tá»‘i thiá»ƒu
                final payload = {
                  'tenThuoc': tenController.text,
                  'tenHoatChat': hoatChatController.text,
                  'maNhom': selectedNhom,
                  'maDVT': selectedDVT,
                  'giaBanLe': giaBanController.text,
                  'giaNhap': giaBanController.text, // Táº¡m
                  'tonKhoHienTai': tonKhoController.text,
                  'hanSuDung': DateFormat(
                    'yyyy-MM-dd',
                  ).format(DateTime.now().add(Duration(days: 365))), // Táº¡m
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/thuoc/${thuoc.maThuoc}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/thuoc', payload);
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
        title: Text('Quáº£n lÃ½ Thuá»‘c'),
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
        tooltip: 'ThÃªm thuá»‘c',
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
                      backgroundColor: Colors.purple[100],
                      child: FaIcon(
                        FontAwesomeIcons.capsules,
                        color: Colors.purple[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      item.tenThuoc,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      'NhÃ³m: ${item.tenNhom} - Tá»“n kho: ${item.tonKho} ${item.tenDVT}',
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
                          onPressed: () {
                            // Cáº§n gá»i API chi tiáº¿t /api/thuoc/:id Ä‘á»ƒ láº¥y Ä‘á»§ dá»¯ liá»‡u
                            // Táº¡m thá»i bá» qua
                          },
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(item.maThuoc),
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
