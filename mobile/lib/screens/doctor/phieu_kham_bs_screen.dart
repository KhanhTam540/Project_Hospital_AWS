// lib/screens/doctor/phieu_kham_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
// Sá»¬A: Import thanh Ä‘iá»u hÆ°á»›ng
import 'doctor_bottom_nav_bar.dart';
// THÃŠM: Import cho upload
import 'package:image_picker/image_picker.dart';

// === Model PhieuKhamModel ===
class PhieuKhamModel {
  final String maPK;
  final String maHSBA;
  final String maBN;
  final String ngayKham;
  final String? trieuChung;
  final String? chuanDoan;
  final String? loiDan;

  PhieuKhamModel({
    required this.maPK,
    required this.maHSBA,
    required this.maBN,
    required this.ngayKham,
    this.trieuChung,
    this.chuanDoan,
    this.loiDan,
  });

  factory PhieuKhamModel.fromJson(Map<String, dynamic> json) {
    String formattedDate = json['ngayKham'] ?? '';
    try {
      formattedDate = DateFormat(
        'dd/MM/yyyy HH:mm',
      ).format(DateTime.parse(json['ngayKham']).toLocal());
    } catch (_) {}

    return PhieuKhamModel(
      maPK: json['maPK'],
      maHSBA: json['maHSBA'],
      maBN: json['maBN'],
      ngayKham: formattedDate,
      trieuChung: json['trieuChung'],
      chuanDoan: json['chuanDoan'],
      loiDan: json['loiDan'],
    );
  }
}

// === Model BenhNhan ===
class BenhNhanModel {
  final String maBN;
  final String hoTen;
  BenhNhanModel({required this.maBN, required this.hoTen});
  factory BenhNhanModel.fromJson(Map<String, dynamic> json) =>
      BenhNhanModel(maBN: json['maBN'], hoTen: json['hoTen'] ?? 'N/A');
}

// === Model HSBA (cáº§n maBN) ===
class HSBAModel {
  final String maHSBA;
  final String maBN;
  final dynamic benhNhan; // 'BenhNhan' object lá»“ng vÃ o (náº¿u cÃ³)

  HSBAModel({required this.maHSBA, required this.maBN, this.benhNhan});

  factory HSBAModel.fromJson(Map<String, dynamic> json) {
    return HSBAModel(
      maHSBA: json['maHSBA'],
      maBN: json['maBN'],
      benhNhan: json['BenhNhan'],
    );
  }
}

// Sá»¬A: Sá»­a láº¡i tÃªn class (bá» chá»¯ 'n' thá»«a)
class PhieuKhamBSScreenn extends StatefulWidget {
  const PhieuKhamBSScreenn({super.key});

  @override
  State<PhieuKhamBSScreenn> createState() => _PhieuKhamBSScreenState();
}

// Sá»¬A: Sá»­a láº¡i tÃªn class
class _PhieuKhamBSScreenState extends State<PhieuKhamBSScreenn> {
  final ApiClient _api = ApiClient();
  List<PhieuKhamModel> _phieuKhams = [];
  bool _isLoading = true;
  String? _maBS;

  List<BenhNhanModel> _benhNhanList = [];
  List<HSBAModel> _hsbaList = [];
  bool _isLoadingDropdowns = true;

  // State cho Form inline
  final _inlineFormKey = GlobalKey<FormState>();
  final _trieuChungController = TextEditingController();
  final _chuanDoanController = TextEditingController();
  final _loiDanController = TextEditingController();
  String? _selectedHSBA;
  String? _selectedBN; // Tá»± Ä‘á»™ng Ä‘iá»n
  bool _isSubmitting = false;

  // THÃŠM: State vÃ  Controller cho chá»©c nÄƒng Upload
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  // Káº¾T THÃšC THÃŠM

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    if (_maBS != null) {
      _loadAllData(); // Gá»i hÃ m táº£i chung
    } else {
      setState(() => _isLoading = false);
      _showError("Lá»—i: KhÃ´ng tÃ¬m tháº¥y mÃ£ BÃ¡c sÄ©.");
    }
  }

  // HÃ m táº£i chung cho cáº£ Form vÃ  List
  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _isLoadingDropdowns = true;
    });
    try {
      await Future.wait([_fetchData(), _loadDropdownData()]);
    } catch (e) {
      _showError("Lá»—i táº£i dá»¯ liá»‡u tá»•ng há»£p: $e");
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _isLoadingDropdowns = false;
        });
      }
    }
  }

  Future<void> _fetchData() async {
    // KhÃ´ng set isLoading á»Ÿ Ä‘Ã¢y ná»¯a
    try {
      final response = await _api.get('/phieukham/bacsi/$_maBS');
      if (!mounted) return;
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _phieuKhams = data
              .map((json) => PhieuKhamModel.fromJson(json))
              .toList();
        });
      }
    } catch (e) {
      _showError('Lá»—i táº£i phiáº¿u khÃ¡m: $e');
    }
  }

  Future<void> _loadDropdownData() async {
    // KhÃ´ng set isLoading á»Ÿ Ä‘Ã¢y ná»¯a
    try {
      final resHSBA = await _api.get('/hsba');
      if (!mounted) return;

      if (resHSBA.statusCode == 200) {
        final hsbaData = jsonDecode(resHSBA.body)['data'] as List;
        _hsbaList = hsbaData.map((j) => HSBAModel.fromJson(j)).toList();

        final uniqueBNs = <String, BenhNhanModel>{};
        for (var j in hsbaData) {
          if (j['BenhNhan'] != null) {
            final bn = BenhNhanModel.fromJson(j['BenhNhan']);
            uniqueBNs[bn.maBN] = bn;
          }
        }
        _benhNhanList = uniqueBNs.values.toList();
      } else {
        _showError('Lá»—i táº£i danh sÃ¡ch HSBA');
      }
    } catch (e) {
      _showError('Lá»—i táº£i danh sÃ¡ch Bá»‡nh nhÃ¢n/HSBA');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
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

  void _onHoSoChanged(String? maHSBA) {
    if (maHSBA == null) {
      setState(() {
        _selectedHSBA = null;
        _selectedBN = null;
      });
      return;
    }
    final selectedHoSo = _hsbaList.firstWhere((hsba) => hsba.maHSBA == maHSBA);
    setState(() {
      _selectedHSBA = maHSBA;
      _selectedBN = selectedHoSo.maBN;
    });
  }

  // Sá»¬A: Cáº­p nháº­t hÃ m _handleCreate Ä‘á»ƒ sá»­ dá»¥ng postMultipart
  Future<void> _handleCreate() async {
    if (!_inlineFormKey.currentState!.validate()) return;
    if (_selectedHSBA == null || _selectedBN == null || _maBS == null) return;

    setState(() => _isSubmitting = true);

    final payload = {
      'trieuChung': _trieuChungController.text,
      'chuanDoan': _chuanDoanController.text,
      'loiDan': _loiDanController.text,
      'trangThai': 'DA_KHAM',
      'maBN': _selectedBN,
      'maHSBA': _selectedHSBA,
      'maBS': _maBS,
      'ngayKham': DateTime.now().toIso8601String(),
    };

    try {
      dynamic response;
      final endpoint = '/phieukham'; // Endpoint chÃ­nh

      if (_selectedImage != null) {
        // DÃ¹ng MULTIPART (Sá»¬A: fileFieldName = 'file')
        final Map<String, String> fields = payload.map(
          (k, v) => MapEntry(k, v?.toString() ?? ''),
        );

        response = await _api.postMultipart(
          endpoint,
          fields,
          file: _selectedImage,
          fileFieldName:
              'file', // <--- Sá»¬A THÃ€NH 'file' Ä‘á»ƒ khá»›p vá»›i backend
        );
      } else {
        // DÃ¹ng JSON POST
        response = await _api.post(endpoint, payload);
      }

      if (response.statusCode == 201) {
        _showSuccess('Táº¡o phiáº¿u khÃ¡m thÃ nh cÃ´ng!');
        _fetchData();
        _inlineFormKey.currentState?.reset();
        _trieuChungController.clear();
        _chuanDoanController.clear();
        _loiDanController.clear();
        setState(() {
          _selectedHSBA = null;
          _selectedBN = null;
          _selectedImage = null; // Reset áº£nh
        });
      } else {
        String errorMessage = 'Lá»—i lÆ°u: ${response.statusCode}';
        try {
          final errorBody = jsonDecode(response.body);
          errorMessage = errorBody['message'] ?? errorMessage;
        } catch (_) {}
        _showError(errorMessage);
      }
    } catch (e) {
      _showError('Lá»—i káº¿t ná»‘i: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleDelete(String maPK) async {
    bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('XÃ¡c nháº­n xÃ³a'),
        content: Text(
          'Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a phiáº¿u khÃ¡m nÃ y?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('KhÃ´ng'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Äá»“ng Ã½'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final res = await _api.delete('/phieukham/$maPK');
      if (res.statusCode == 200) {
        _showSuccess("XÃ³a phiáº¿u thÃ nh cÃ´ng!");
        _fetchData();
      } else {
        _showError("Lá»—i: KhÃ´ng thá»ƒ xÃ³a phiáº¿u.");
      }
    } catch (e) {
      _showError("Lá»—i káº¿t ná»‘i khi xÃ³a.");
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sá»¬A: ThÃªm Scaffold, AppBar, vÃ  BottomNav
    return Scaffold(
      backgroundColor: Theme.of(
        context,
      ).scaffoldBackgroundColor, // Äá»“ng bá»™ mÃ u ná»n
      appBar: AppBar(
        title: Text('Phiáº¿u khÃ¡m bá»‡nh'),
        backgroundColor: Color(0xFF004D40), // MÃ u xanh Ä‘áº­m cá»§a bÃ¡c sÄ©
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
      body: RefreshIndicator(
        onRefresh: _loadAllData, // DÃ¹ng hÃ m táº£i chung
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Form inline
              Padding(
                padding: const EdgeInsets.all(16.0).copyWith(bottom: 0),
                child: Text(
                  'Táº¡o phiáº¿u khÃ¡m bá»‡nh',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              _buildInlineForm(), // Widget Form
              // Danh sÃ¡ch
              Padding(
                padding: const EdgeInsets.all(16.0).copyWith(bottom: 8, top: 8),
                child: Text(
                  'Lá»‹ch sá»­ phiáº¿u khÃ¡m',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              (_isLoading || _isLoadingDropdowns) // Sá»­a: Gá»™p 2 cá» loading
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : _phieuKhams.isEmpty
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Text('ChÆ°a cÃ³ phiáº¿u khÃ¡m nÃ o.'),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _phieuKhams.length,
                      shrinkWrap: true,
                      physics: NeverScrollableScrollPhysics(),
                      itemBuilder: (context, index) {
                        final phieu = _phieuKhams[index];

                        // An toÃ n hÆ¡n: tÃ¬m tÃªn BN
                        final tenBN = _benhNhanList
                            .firstWhere(
                              (bn) => bn.maBN == phieu.maBN,
                              orElse: () => BenhNhanModel(
                                maBN: phieu.maBN,
                                hoTen: phieu.maBN,
                              ),
                            )
                            .hoTen;

                        return Card(
                          margin: EdgeInsets.only(bottom: 10),
                          elevation: 2,
                          child: ListTile(
                            leading: FaIcon(
                              FontAwesomeIcons.fileLines,
                              color: Colors.blue[700],
                            ),
                            title: Text(
                              'BN: $tenBN (HSBA: ${phieu.maHSBA})',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                            subtitle: Text(
                              'Cháº©n Ä‘oÃ¡n: ${phieu.chuanDoan ?? "ChÆ°a cÃ³"}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(phieu.ngayKham.split(' ')[0]),
                                    Text(phieu.ngayKham.split(' ')[1]),
                                  ],
                                ),
                                IconButton(
                                  icon: Icon(
                                    Icons.delete_outline,
                                    color: Colors.red[700],
                                  ),
                                  tooltip: 'XÃ³a phiáº¿u',
                                  onPressed: () => _handleDelete(phieu.maPK),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ],
          ),
        ),
      ),
      // Sá»¬A: ThÃªm Bottom Nav Bar, index = 3
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 3),
    );
  }

  // === THAY THáº¾ TOÃ€N Bá»˜ HÃ€M NÃ€Y (CÃ³ tÃ­ch há»£p Upload) ===
  // Widget build form inline
  Widget _buildInlineForm() {
    return Card(
      margin: EdgeInsets.all(16),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _inlineFormKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Chá»n HSBA
              DropdownButtonFormField<String>(
                decoration: InputDecoration(
                  labelText: 'Chá»n HSBA',
                  border: OutlineInputBorder(),
                ),
                initialValue: _selectedHSBA,
                items: _hsbaList
                    .map(
                      (hsba) => DropdownMenuItem<String>(
                        value: hsba.maHSBA,
                        child: Text(
                          '${hsba.maHSBA} (${hsba.benhNhan?['hoTen'] ?? 'N/A'})',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _isLoadingDropdowns ? null : _onHoSoChanged,
                validator: (v) => v == null ? 'Vui lÃ²ng chá»n' : null,
              ),
              SizedBox(height: 12),

              // 2. Bá»‡nh nhÃ¢n (Tá»± Ä‘á»™ng Ä‘iá»n)
              TextFormField(
                key: Key(_selectedBN ?? 'empty'),
                initialValue: _benhNhanList
                    .firstWhere(
                      (bn) => bn.maBN == _selectedBN,
                      orElse: () => BenhNhanModel(maBN: '', hoTen: ''),
                    )
                    .hoTen,
                readOnly: true,
                decoration: InputDecoration(
                  labelText: 'Bá»‡nh nhÃ¢n',
                  border: OutlineInputBorder(),
                  filled: _selectedBN != null,
                  fillColor: Theme.of(
                    context,
                  ).colorScheme.surfaceContainerHighest,
                ),
              ),
              SizedBox(height: 12),

              // 3. Triá»‡u chá»©ng
              TextFormField(
                controller: _trieuChungController,
                decoration: InputDecoration(
                  labelText: 'Triá»‡u chá»©ng',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.isEmpty)
                    ? 'KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng'
                    : null,
              ),
              SizedBox(height: 12),

              // 4. Cháº©n Ä‘oÃ¡n
              TextFormField(
                controller: _chuanDoanController,
                decoration: InputDecoration(
                  labelText: 'Cháº©n Ä‘oÃ¡n',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => (v == null || v.isEmpty)
                    ? 'KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng'
                    : null,
              ),
              SizedBox(height: 12),

              // 5. Lá»i dáº·n
              TextFormField(
                controller: _loiDanController,
                decoration: InputDecoration(
                  labelText: 'Lá»i dáº·n',
                  border: OutlineInputBorder(),
                ),
              ),

              // THÃŠM: VÃ¹ng chá»n áº£nh
              SizedBox(height: 16),
              Text(
                'HÃ¬nh áº£nh Ä‘Ã­nh kÃ¨m (TÃ¹y chá»n):',
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

              // 6. NÃºt LÆ°u
              ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _handleCreate,
                icon: _isSubmitting
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Icon(Icons.save),
                label: Text(
                  _isSubmitting ? 'Äang lÆ°u...' : 'LÆ°u phiáº¿u khÃ¡m',
                ),
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 44),
                  backgroundColor:
                      Colors.blue[800], // MÃ u xanh dÆ°Æ¡ng (giá»‘ng trang web)
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ), // Bo gÃ³c nÃºt
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
