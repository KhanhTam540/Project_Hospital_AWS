// lib/screens/admin/quan_ly_tro_ly_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart'; // ThÃªm import
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';
import '../../models/user_model.dart'; // DÃ¹ng UserModel Ä‘á»ƒ láº¥y DS BÃ¡c sÄ©/NhÃ¢n sá»±

// Model
class TroLyModel {
  final String maTroLy;
  final String maNS;
  final String maBacSi;
  final String? phamViUyQuyen;

  TroLyModel({
    required this.maTroLy,
    required this.maNS,
    required this.maBacSi,
    this.phamViUyQuyen,
  });

  factory TroLyModel.fromJson(Map<String, dynamic> json) {
    return TroLyModel(
      maTroLy: json['maTroLy'],
      maNS: json['maNS'],
      maBacSi: json['maBacSi'],
      phamViUyQuyen: json['phamViUyQuyen'],
    );
  }
}

class QuanLyTroLyScreen extends StatefulWidget {
  const QuanLyTroLyScreen({super.key});

  @override
  State<QuanLyTroLyScreen> createState() => _QuanLyTroLyScreenState();
}

class _QuanLyTroLyScreenState extends State<QuanLyTroLyScreen> {
  final ApiClient _api = ApiClient();
  List<TroLyModel> _list = [];
  List<UserModel> _nhanSuList = [];
  List<UserModel> _bacSiList = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // Backend: /api/tro-ly (controller.js) tráº£ vá» { data: { items: [...] } }
      final resTroLy = await _api.get('/tro-ly');
      final resUsers = await _api.get('/tai-khoan');

      if (resTroLy.statusCode == 200 && resUsers.statusCode == 200) {
        final dataTroLy = jsonDecode(resTroLy.body)['data']['items'] as List;
        final dataUsers = jsonDecode(resUsers.body)['data'] as List;

        final allUsers = dataUsers
            .map((json) => UserModel.fromJson(json))
            .toList();

        setState(() {
          _list = dataTroLy.map((json) => TroLyModel.fromJson(json)).toList();
          // Lá»c ra danh sÃ¡ch BS vÃ  NS (loáº¡i YT - Y tÃ¡) Ä‘á»ƒ Ä‘iá»n vÃ o dropdown
          _bacSiList = allUsers.where((u) => u.maNhom == 'BACSI').toList();
          _nhanSuList = allUsers
              .where((u) => u.maNhom == 'NHANSU' && u.loaiNS == 'YT')
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      _showError('Lá»—i táº£i dá»¯ liá»‡u: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
    setState(() => _isLoading = false);
  }

  Future<void> _handleDelete(String maTroLy) async {
    final confirm = await _showConfirmDialog(
      'XÃ¡c nháº­n xoÃ¡',
      'Báº¡n cÃ³ cháº¯c muá»‘n xoÃ¡ phÃ¢n cÃ´ng nÃ y?',
    );
    if (confirm != true) return;

    try {
      final response = await _api.delete('/tro-ly/$maTroLy');
      if (!mounted) return;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âœ… ÄÃ£ xoÃ¡'),
            backgroundColor: Colors.green,
          ),
        );
        _fetchData();
      } else {
        _showError('Lá»—i: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i: $e');
    }
  }

  Future<void> _showAddEditDialog({TroLyModel? troLy}) async {
    final formKey = GlobalKey<FormState>();
    final bool isEdit = troLy != null;

    String? selectedNS = isEdit ? troLy.maNS : null;
    String? selectedBS = isEdit ? troLy.maBacSi : null;
    final phamViController = TextEditingController(text: troLy?.phamViUyQuyen);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sá»­a PhÃ¢n cÃ´ng' : 'ThÃªm Trá»£ lÃ½'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'NhÃ¢n viÃªn Y tÃ¡',
                    border: OutlineInputBorder(),
                  ),
                  initialValue: selectedNS,
                  items: _nhanSuList
                      .map(
                        (ns) => DropdownMenuItem<String>(
                          value: ns.maNS,
                          child: Text(ns.hoTen ?? ns.tenDangNhap),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => selectedNS = v,
                  validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                ),
                SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'BÃ¡c sÄ© phá»¥ trÃ¡ch',
                    border: OutlineInputBorder(),
                  ),
                  initialValue: selectedBS,
                  items: _bacSiList
                      .map(
                        (bs) => DropdownMenuItem<String>(
                          value: bs.maBS,
                          child: Text(bs.hoTen ?? bs.tenDangNhap),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => selectedBS = v,
                  validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: phamViController,
                  decoration: InputDecoration(
                    labelText: 'Pháº¡m vi uá»· quyá»n',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
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
                  'maNS': selectedNS,
                  'maBacSi': selectedBS,
                  'phamViUyQuyen': phamViController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put(
                      '/tro-ly/${troLy.maTroLy}',
                      payload,
                    );
                  } else {
                    response = await _api.post('/tro-ly', payload);
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
        title: Text('Quáº£n lÃ½ Trá»£ lÃ½ BÃ¡c sÄ©'),
        backgroundColor: Theme.of(context).colorScheme.primary,
        // THÃŠM NÃšT
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
        tooltip: 'PhÃ¢n cÃ´ng trá»£ lÃ½',
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
                  elevation: 2,
                  child: ListTile(
                    leading: FaIcon(
                      FontAwesomeIcons.userSecret,
                      color: Colors.teal[700],
                    ),
                    title: Text(
                      'Y tÃ¡: ${item.maNS}',
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text('Há»— trá»£ BÃ¡c sÄ©: ${item.maBacSi}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(Icons.edit, color: Colors.orange),
                          onPressed: () => _showAddEditDialog(troLy: item),
                        ),
                        IconButton(
                          icon: Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _handleDelete(item.maTroLy),
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
