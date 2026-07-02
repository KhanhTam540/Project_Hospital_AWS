// lib/screens/doctor/ke_don_thuoc_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'package:intl/intl.dart';
// THÃŠM: Import cho upload
import 'package:image_picker/image_picker.dart';

// === Sá»¬A 1: Model cho Phiáº¿u KhÃ¡m (thay vÃ¬ HSBA) ===
class PhieuKham {
  final String maPK;
  final String maBN;
  final String ngayKham; // Giá»¯ String Ä‘á»ƒ hiá»ƒn thá»‹
  PhieuKham({required this.maPK, required this.maBN, required this.ngayKham});
  factory PhieuKham.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayKham'] ?? '';
    try {
      fNgay = DateFormat('dd/MM/yyyy').format(DateTime.parse(json['ngayKham']));
    } catch (_) {}
    return PhieuKham(maPK: json['maPK'], maBN: json['maBN'], ngayKham: fNgay);
  }
}
// === Káº¾T THÃšC Sá»¬A 1 ===

class Thuoc {
  final String maThuoc;
  final String tenThuoc;
  Thuoc({required this.maThuoc, required this.tenThuoc});
  factory Thuoc.fromJson(Map<String, dynamic> json) =>
      Thuoc(maThuoc: json['maThuoc'], tenThuoc: json['tenThuoc']);
}

class KeDonThuocScreen extends StatefulWidget {
  const KeDonThuocScreen({super.key});

  @override
  State<KeDonThuocScreen> createState() => _KeDonThuocScreenState();
}

class _KeDonThuocScreenState extends State<KeDonThuocScreen> {
  final ApiClient _api = ApiClient();
  final _formKeyChiTiet = GlobalKey<FormState>();
  String? _maBS;

  // Data
  List<PhieuKham> _phieuKhamList = [];
  List<Thuoc> _thuocList = [];

  // === Sá»¬A 2: State cho logic má»›i ===
  List<Map<String, dynamic>> _thuocDaThem = [];
  String? _selectedMaPK;
  // === Káº¾T THÃšC Sá»¬A 2 ===
  // Form chi tiáº¿t
  String? _selectedThuoc;
  final _soLuongController = TextEditingController();
  final _lieuDungController = TextEditingController();

  // THÃŠM: State vÃ  Controller cho chá»©c nÄƒng Upload
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  // Káº¾T THÃšC THÃŠM

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _fetchInitialData();
  }

  Future<void> _fetchInitialData() async {
    if (_maBS == null) {
      _showError("Lá»—i: KhÃ´ng tÃ¬m tháº¥y MÃ£ BÃ¡c SÄ©.");
      return;
    }
    try {
      // Sá»­a: Láº¥y phiáº¿u khÃ¡m theo BÃ¡c SÄ©
      final resPK = await _api.get('/phieukham/bacsi/$_maBS');
      final resThuoc = await _api.get('/thuoc');

      setState(() {
        _phieuKhamList = (jsonDecode(resPK.body)['data'] as List)
            .map((j) => PhieuKham.fromJson(j))
            .toList();
        _thuocList = (jsonDecode(resThuoc.body)['data'] as List)
            .map((j) => Thuoc.fromJson(j))
            .toList();
      });
    } catch (e) {
      _showError('Lá»—i táº£i dá»¯ liá»‡u: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  // THÃŠM: HÃ m chá»n áº£nh
  Future<void> _pickImage() async {
    final XFile? pickedFile = await _picker.pickImage(
      source: ImageSource.gallery,
    );
    if (pickedFile != null) {
      setState(() {
        _selectedImage = pickedFile;
      });
    }
  }
  // Káº¾T THÃšC THÃŠM

  // Sá»¬A: Sá»­a hÃ m _handleAddThuoc thÃ nh _stageThuoc
  void _stageThuoc() {
    if (!_formKeyChiTiet.currentState!.validate()) return;
    if (_selectedThuoc == null) {
      _showError("Vui lÃ²ng chá»n thuá»‘c");
      return;
    }

    final selectedThuoc = _thuocList.firstWhere(
      (t) => t.maThuoc == _selectedThuoc,
    );

    setState(() {
      _thuocDaThem.add({
        'maThuoc': _selectedThuoc,
        'tenThuoc': selectedThuoc.tenThuoc, // Láº¥y cáº£ tÃªn thuá»‘c
        'soLuong': int.parse(_soLuongController.text),
        'lieuDung': _lieuDungController.text,
      });
    });

    // Reset form
    _soLuongController.clear();
    _lieuDungController.clear();
    setState(() => _selectedThuoc = null);
  }

  // Sá»¬A: HÃ m má»›i Ä‘á»ƒ xÃ³a thuá»‘c khá»i danh sÃ¡ch táº¡m
  void _removeThuoc(int index) {
    setState(() {
      _thuocDaThem.removeAt(index);
    });
  }

  // Sá»¬A: HÃ m _handleSaveAll Ä‘á»ƒ há»— trá»£ upload hÃ¬nh áº£nh
  Future<void> _handleSaveAll() async {
    if (_selectedMaPK == null) {
      _showError("Vui lÃ²ng chá»n má»™t phiáº¿u khÃ¡m");
      return;
    }
    if (_thuocDaThem.isEmpty) {
      _showError("Vui lÃ²ng thÃªm Ã­t nháº¥t 1 loáº¡i thuá»‘c");
      return;
    }

    final chiTietJson = jsonEncode(_thuocDaThem);
    final endpoint = '/donthuoc'; // Endpoint chÃ­nh

    // Payload cho request JSON (náº¿u khÃ´ng cÃ³ file)
    final jsonPayload = {
      'maPK': _selectedMaPK,
      'maBS': _maBS,
      'chiTietList': _thuocDaThem,
    };

    // Chuáº©n bá»‹ fields cho Multipart (khi cÃ³ file)
    final Map<String, String> multipartFields = {
      'maPK': _selectedMaPK!,
      'maBS': _maBS!,
      'chiTietList':
          chiTietJson, // Gá»­i chi tiáº¿t thuá»‘c dÆ°á»›i dáº¡ng JSON string
    };

    try {
      dynamic res;
      if (_selectedImage != null) {
        // DÃ¹ng MULTIPART
        res = await _api.postMultipart(
          endpoint,
          multipartFields,
          file: _selectedImage,
          fileFieldName: 'file', // <--- Sá»¬A THÃ€NH 'file'
        );
      } else {
        // DÃ¹ng JSON POST
        res = await _api.post(endpoint, jsonPayload);
      }

      if (res.statusCode == 201) {
        _showError("âœ… ÄÃ£ lÆ°u Ä‘Æ¡n thuá»‘c thÃ nh cÃ´ng!");
        // Reset toÃ n bá»™
        setState(() {
          _thuocDaThem = [];
          _selectedMaPK = null;
          _selectedThuoc = null;
          _selectedImage = null; // Reset áº£nh
        });
      } else {
        String errorMessage = 'Lá»—i tá»« server: ${res.statusCode}';
        try {
          final errorBody = jsonDecode(res.body);
          errorMessage = errorBody['message'] ?? errorMessage;
        } catch (_) {}
        _showError(errorMessage);
      }
    } catch (e) {
      _showError('Lá»—i khi lÆ°u Ä‘Æ¡n thuá»‘c: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('KÃª Ä‘Æ¡n thuá»‘c'),
        backgroundColor: Color(0xFF004D40),
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chá»§',
            onPressed: () => context.go('/doctor'),
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
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'KÃª Ä‘Æ¡n thuá»‘c',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),

            // Form chá»n Phiáº¿u KhÃ¡m
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Chá»n Phiáº¿u KhÃ¡m cáº§n kÃª Ä‘Æ¡n',
                    border: OutlineInputBorder(),
                  ),
                  initialValue: _selectedMaPK,
                  items: _phieuKhamList
                      .map(
                        (pk) => DropdownMenuItem<String>(
                          value: pk.maPK,
                          child: Text('${pk.maPK} ( ${pk.ngayKham})'),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() {
                    _selectedMaPK = v;
                    _thuocDaThem = []; // Reset khi Ä‘á»•i phiáº¿u
                    _selectedImage = null; // Reset áº£nh
                  }),
                  validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
                ),
              ),
            ),

            if (_selectedMaPK != null) ...[
              SizedBox(height: 24),
              Text(
                'Äang kÃª Ä‘Æ¡n cho: $_selectedMaPK',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: Colors.green[700]),
              ),
              SizedBox(height: 16),

              // 2. ThÃªm thuá»‘c
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Form(
                    key: _formKeyChiTiet,
                    child: Column(
                      children: [
                        DropdownButtonFormField<String>(
                          decoration: InputDecoration(
                            labelText: 'Chá»n Thuá»‘c',
                            border: OutlineInputBorder(),
                          ),
                          initialValue: _selectedThuoc,
                          items: _thuocList
                              .map(
                                (t) => DropdownMenuItem<String>(
                                  value: t.maThuoc,
                                  child: Text(t.tenThuoc),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _selectedThuoc = v),
                          validator: (v) =>
                              v == null ? 'Vui lÃ²ng chá»n' : null,
                        ),
                        SizedBox(height: 16),
                        TextFormField(
                          controller: _soLuongController,
                          decoration: InputDecoration(
                            labelText: 'Sá»‘ lÆ°á»£ng',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                          validator: (v) =>
                              v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
                        ),
                        SizedBox(height: 16),
                        TextFormField(
                          controller: _lieuDungController,
                          decoration: InputDecoration(
                            labelText: 'Liá»u dÃ¹ng (vd: SÃ¡ng 1, Tá»‘i 1)',
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v!.isEmpty ? 'KhÃ´ng bá» trá»‘ng' : null,
                        ),
                        SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed:
                              _stageThuoc, // Sá»­a: gá»i hÃ m _stageThuoc
                          icon: Icon(Icons.add),
                          label: Text('ThÃªm thuá»‘c vÃ o Ä‘Æ¡n'),
                          style: ElevatedButton.styleFrom(
                            minimumSize: Size(double.infinity, 44),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              SizedBox(height: 16),

              // THÃŠM: VÃ¹ng chá»n áº£nh
              Text(
                'HÃ¬nh áº£nh/Chá»¯ kÃ½ (TÃ¹y chá»n):',
                style: TextStyle(fontWeight: FontWeight.w500),
              ),
              SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _pickImage,
                      icon: Icon(Icons.photo_library),
                      label: Text(
                        _selectedImage == null
                            ? 'Chá»n áº£nh'
                            : 'Äá»•i áº£nh',
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.grey[200],
                        foregroundColor: Colors.black87,
                      ),
                    ),
                  ),
                  if (_selectedImage != null) ...[
                    SizedBox(width: 10),
                    Expanded(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Flexible(
                            child: Text(
                              'ÄÃ£ chá»n: ${_selectedImage!.name}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            icon: Icon(Icons.close, color: Colors.red),
                            onPressed: () =>
                                setState(() => _selectedImage = null),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              SizedBox(height: 16),
              // Káº¾T THÃšC THÃŠM

              // 3. Danh sÃ¡ch thuá»‘c Ä‘Ã£ kÃª (tá»« state _thuocDaThem)
              Text(
                'Chi tiáº¿t Ä‘Æ¡n thuá»‘c (Ä‘ang soáº¡n)',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              _thuocDaThem.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24.0),
                      child: Center(
                        child: Text('ChÆ°a cÃ³ thuá»‘c nÃ o Ä‘Æ°á»£c thÃªm'),
                      ),
                    )
                  : Card(
                      elevation: 2,
                      child: Column(
                        children: _thuocDaThem.asMap().entries.map((entry) {
                          int idx = entry.key;
                          var item = entry.value;
                          return ListTile(
                            leading: FaIcon(
                              FontAwesomeIcons.pills,
                              size: 20,
                              color: Colors.purple,
                            ),
                            title: Text(
                              '${item['tenThuoc']} (SL: ${item['soLuong']})',
                            ),
                            subtitle: Text('Liá»u dÃ¹ng: ${item['lieuDung']}'),
                            trailing: IconButton(
                              icon: Icon(
                                Icons.delete_outline,
                                color: Colors.red,
                              ),
                              onPressed: () => _removeThuoc(idx),
                            ),
                          );
                        }).toList(),
                      ),
                    ),

              SizedBox(height: 24),
              // NÃºt LÆ°u ÄÆ¡n Thuá»‘c HoÃ n Chá»‰nh
              if (_thuocDaThem.isNotEmpty)
                ElevatedButton.icon(
                  onPressed: _handleSaveAll,
                  icon: Icon(Icons.save),
                  label: Text('LÆ°u ÄÆ¡n Thuá»‘c HoÃ n Chá»‰nh'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: Size(double.infinity, 48),
                    backgroundColor: Colors.green[700],
                    foregroundColor: Colors.white,
                    textStyle: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
