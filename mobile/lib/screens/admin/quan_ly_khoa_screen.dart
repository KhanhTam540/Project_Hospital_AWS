// lib/screens/admin/quan_ly_khoa_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart'; // ThÃªm import
import 'package:provider/provider.dart'; // ThÃªm import
import '../../auth/auth_provider.dart'; // ThÃªm import
import '../../services/api_client.dart';

// Model Ä‘Æ¡n giáº£n cho Khoa
class KhoaModel {
  final String maKhoa;
  final String tenKhoa;
  final String? moTa;

  KhoaModel({required this.maKhoa, required this.tenKhoa, this.moTa});

  factory KhoaModel.fromJson(Map<String, dynamic> json) {
    return KhoaModel(
      maKhoa: json['maKhoa'] ?? 'N/A',
      tenKhoa: json['tenKhoa'] ?? 'N/A',
      moTa: json['moTa'],
    );
  }
}

class QuanLyKhoaScreen extends StatefulWidget {
  const QuanLyKhoaScreen({super.key});

  @override
  State<QuanLyKhoaScreen> createState() => _QuanLyKhoaScreenState();
}

class _QuanLyKhoaScreenState extends State<QuanLyKhoaScreen> {
  final ApiClient _api = ApiClient();
  List<KhoaModel> _khoas = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchKhoas();
  }

  // Láº¥y danh sÃ¡ch khoa tá»« API /api/khoa
  Future<void> _fetchKhoas() async {
    setState(() => _isLoading = true);
    try {
      final response = await _api.get('/khoa');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _khoas = data.map((json) => KhoaModel.fromJson(json)).toList();
        });
      } else {
        _showError('Lá»—i: ${jsonDecode(response.body)['message']}');
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

  // Xá»­ lÃ½ XÃ³a
  Future<void> _handleDelete(String maKhoa) async {
    final confirm = await _showConfirmDialog(
      'XÃ¡c nháº­n xoÃ¡',
      'Báº¡n cÃ³ cháº¯c muá»‘n xoÃ¡ khoa $maKhoa?',
    );
    if (confirm != true) return;

    try {
      final response = await _api.delete('/khoa/$maKhoa');
      if (!mounted) return;
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('âœ… ÄÃ£ xoÃ¡ khoa $maKhoa'),
            backgroundColor: Colors.green,
          ),
        );
        _fetchKhoas(); // Táº£i láº¡i danh sÃ¡ch
      } else {
        _showError('Lá»—i: ${jsonDecode(response.body)['message']}');
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i: $e');
    }
  }

  // Hiá»ƒn thá»‹ Dialog ThÃªm/Sá»­a
  Future<void> _showAddEditDialog({KhoaModel? khoa}) async {
    final formKey = GlobalKey<FormState>();
    final tenKhoaController = TextEditingController(text: khoa?.tenKhoa);
    final moTaController = TextEditingController(text: khoa?.moTa);
    final bool isEdit = khoa != null;

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(isEdit ? 'Sá»­a Khoa' : 'ThÃªm Khoa Má»›i'),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: tenKhoaController,
                  decoration: InputDecoration(
                    labelText: 'TÃªn khoa',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      v!.isEmpty ? 'KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng' : null,
                ),
                SizedBox(height: 16),
                TextFormField(
                  controller: moTaController,
                  decoration: InputDecoration(
                    labelText: 'MÃ´ táº£',
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
                  'tenKhoa': tenKhoaController.text,
                  'moTa': moTaController.text,
                };

                try {
                  dynamic response;
                  if (isEdit) {
                    response = await _api.put('/khoa/${khoa.maKhoa}', payload);
                  } else {
                    response = await _api.post('/khoa', payload);
                  }

                  if (!mounted || !ctx.mounted) return;

                  if (response.statusCode == 200 ||
                      response.statusCode == 201) {
                    Navigator.of(ctx).pop();
                    _fetchKhoas(); // Táº£i láº¡i danh sÃ¡ch
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

  // Dialog xÃ¡c nháº­n
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
        title: Text('Quáº£n lÃ½ Khoa'),
        backgroundColor: Theme.of(
          context,
        ).colorScheme.primary, // Thá»‘ng nháº¥t mÃ u
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
        tooltip: 'ThÃªm khoa má»›i',
        child: Icon(Icons.add),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: EdgeInsets.all(16),
              itemCount: _khoas.length,
              itemBuilder: (context, index) {
                final khoa = _khoas[index];
                return Card(
                  margin: EdgeInsets.only(bottom: 10),
                  elevation: 2,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.green[100],
                      child: FaIcon(
                        FontAwesomeIcons.hospital,
                        color: Colors.green[700],
                        size: 20,
                      ),
                    ),
                    title: Text(
                      khoa.tenKhoa,
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(khoa.moTa ?? 'MÃ£ khoa: ${khoa.maKhoa}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.edit,
                            color: Colors.orange[700],
                            size: 20,
                          ),
                          onPressed: () => _showAddEditDialog(khoa: khoa),
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.delete,
                            color: Colors.red[700],
                            size: 20,
                          ),
                          onPressed: () => _handleDelete(khoa.maKhoa),
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
