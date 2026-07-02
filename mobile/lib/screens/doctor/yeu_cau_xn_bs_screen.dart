import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';

// (Models)
class YeuCauXN {
  final String maYeuCau;
  final String maBN;
  final String? tenBN; // ThÃªm tÃªn bá»‡nh nhÃ¢n
  final String? tenBS;
  final String loaiYeuCau;
  final String trangThai;
  final String ngayYeuCau;

  YeuCauXN({
    required this.maYeuCau,
    required this.maBN,
    this.tenBN,
    this.tenBS,
    required this.loaiYeuCau,
    required this.trangThai,
    required this.ngayYeuCau,
  });

  factory YeuCauXN.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayYeuCau'] ?? '';
    try {
      fNgay = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayYeuCau']).toLocal());
    } catch (_) {}
    return YeuCauXN(
      maYeuCau: json['maYeuCau'],
      maBN: json['maBN'],
      tenBN:
          json['BenhNhan']?['hoTen'] ?? json['maBN'], // Láº¥y tÃªn bá»‡nh nhÃ¢n
      tenBS: json['BacSi']?['hoTen'] ?? 'N/A',
      loaiYeuCau: json['loaiYeuCau'] ?? 'THONG_THUONG',
      trangThai: json['trangThai'] ?? 'CHO_THUC_HIEN',
      ngayYeuCau: fNgay,
    );
  }
}

// Model don gi?n cho Dropdown
class BenhNhanSimple {
  final String maBN;
  final String hoTen;
  BenhNhanSimple({required this.maBN, required this.hoTen});
  factory BenhNhanSimple.fromJson(Map<String, dynamic> json) =>
      BenhNhanSimple(maBN: json['maBN'], hoTen: json['hoTen'] ?? json['maBN']);
}

class YeuCauXNBSScreen extends StatefulWidget {
  const YeuCauXNBSScreen({super.key});

  @override
  State<YeuCauXNBSScreen> createState() => _YeuCauXNBSScreenState();
}

class _YeuCauXNBSScreenState extends State<YeuCauXNBSScreen> {
  final _formKey = GlobalKey<FormState>();
  final ApiClient _api = ApiClient();

  // Data State
  List<YeuCauXN> _list = [];
  List<BenhNhanSimple> _dsBenhNhan = [];

  // UI State
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _maBS;

  // Form State
  String? _selectedMaBN;
  String? _selectedLoaiYeuCau = 'THONG_THUONG';

  final List<Map<String, String>> _loaiYeuCauOptions = const [
    {'value': 'THONG_THUONG', 'label': 'ThÃ´ng thÆ°á»ng'},
    {'value': 'KHAN_CAP', 'label': 'Kh?n c?p'},
    {'value': 'THEO_DOI', 'label': 'Theo dÃµi'},
  ];

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    setState(() => _isLoading = true);
    try {
      final responses = await Future.wait([
        _api.get('/yeucauxetnghiem'), // List YC (c?n l?c)
        _api.get('/benhnhan'), // Danh sÃ¡ch bá»‡nh nhÃ¢n cho biá»ƒu máº«u
      ]);

      // 1. Láº¥y danh sÃ¡ch yÃªu cáº§u theo mÃ£ bÃ¡c sÄ©
      if (responses[0].statusCode == 200) {
        final data = jsonDecode(responses[0].body)['data'] as List;
        final filteredList = data
            .map((json) => YeuCauXN.fromJson(json))
            .where(
              (item) =>
                  data.firstWhere(
                    (j) => j['maYeuCau'] == item.maYeuCau,
                  )['maBS'] ==
                  _maBS,
            )
            .toList();
        _list = filteredList;
      }

      // 2. Láº¥y danh sÃ¡ch bá»‡nh nhÃ¢n
      if (responses[1].statusCode == 200) {
        final data = jsonDecode(responses[1].body)['data'] as List;
        _dsBenhNhan = data
            .map((json) => BenhNhanSimple.fromJson(json))
            .toList();
      }
    } catch (e) {
      _showError('L?i t?i d? li?u: $e');
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

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  String _displayTrangThai(String trangThai) {
    switch (trangThai) {
      case 'CHO_THUC_HIEN':
        return 'Ch? th?c hi?n';
      case 'DA_LAY_MAU':
        return 'ÄÃ£ láº¥y máº«u';
      case 'DA_HOAN_THANH':
        return 'ÄÃ£ hoÃ n thÃ nh';
      default:
        return trangThai;
    }
  }

  // --- HÃ€M Táº O YÃŠU Cáº¦U XÃ‰T NGHIá»†M ---
  Future<void> _handleCreateYeuCau() async {
    if (!_formKey.currentState!.validate() || _maBS == null) return;
    setState(() => _isSubmitting = true);

    final payload = {
      'maBN': _selectedMaBN,
      'loaiYeuCau': _selectedLoaiYeuCau,
      'trangThai': 'CHO_THUC_HIEN', // LuÃ´n khá»Ÿi táº¡o
      // maBS du?c l?y t? token ? backend
    };

    try {
      // API: POST /api/yeucauxetnghiem
      final response = await _api.post('/yeucauxetnghiem', payload);

      if (response.statusCode == 201) {
        _showSuccess('Táº¡o yÃªu cáº§u xÃ©t nghiá»‡m thÃ nh cÃ´ng!');
        _loadAllData();
        _formKey.currentState?.reset();
        setState(() {
          _selectedMaBN = null;
          _selectedLoaiYeuCau = 'THONG_THUONG';
        });
      } else {
        _showError(
          jsonDecode(response.body)['message'] ??
              'Lá»—i táº¡o yÃªu cáº§u xÃ©t nghiá»‡m.',
        );
      }
    } catch (e) {
      _showError('L?i k?t n?i: $e');
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('YÃªu cáº§u xÃ©t nghiá»‡m'),
        backgroundColor: Color(0xFF004D40), // MÃ u bÃ¡c sÄ©
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang ch?',
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
        onRefresh: _loadAllData,
        child: SingleChildScrollView(
          padding: EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- FORM Táº O YÃŠU Cáº¦U ---
              Text(
                'Táº¡o yÃªu cáº§u xÃ©t nghiá»‡m',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: 16),
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      children: [
                        // 1. Chá»n bá»‡nh nhÃ¢n
                        DropdownButtonFormField<String>(
                          decoration: InputDecoration(
                            labelText: 'Chá»n bá»‡nh nhÃ¢n',
                            border: OutlineInputBorder(),
                          ),
                          initialValue: _selectedMaBN,
                          items: _dsBenhNhan
                              .map(
                                (bn) => DropdownMenuItem<String>(
                                  value: bn.maBN,
                                  child: Text('${bn.hoTen} (${bn.maBN})'),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => setState(() => _selectedMaBN = v),
                          validator: (v) => v == null
                              ? 'Vui lÃ²ng chá»n bá»‡nh nhÃ¢n'
                              : null,
                        ),
                        SizedBox(height: 16),
                        // 2. Loáº¡i yÃªu cáº§u
                        DropdownButtonFormField<String>(
                          decoration: InputDecoration(
                            labelText: 'Loáº¡i yÃªu cáº§u',
                            border: OutlineInputBorder(),
                          ),
                          initialValue: _selectedLoaiYeuCau,
                          items: _loaiYeuCauOptions
                              .map(
                                (opt) => DropdownMenuItem<String>(
                                  value: opt['value'],
                                  child: Text(opt['label']!),
                                ),
                              )
                              .toList(),
                          onChanged: (v) =>
                              setState(() => _selectedLoaiYeuCau = v),
                          validator: (v) => v == null
                              ? 'Vui lÃ²ng chá»n loáº¡i yÃªu cáº§u'
                              : null,
                        ),
                        SizedBox(height: 20),
                        // NÃºt thao tÃ¡c
                        ElevatedButton.icon(
                          onPressed: _isSubmitting ? null : _handleCreateYeuCau,
                          icon: _isSubmitting
                              ? SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : FaIcon(FontAwesomeIcons.vial, size: 18),
                          label: Text(
                            _isSubmitting
                                ? 'Äang táº¡o...'
                                : 'Táº¡o yÃªu cáº§u xÃ©t nghiá»‡m',
                          ),
                          style: ElevatedButton.styleFrom(
                            minimumSize: Size(double.infinity, 44),
                            backgroundColor: Colors.blue[700],
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              SizedBox(height: 30),

              // --- DANH SÃCH YÃŠU Cáº¦U ÄÃƒ Gá»¬I ---
              Text(
                'Lá»‹ch sá»­ yÃªu cáº§u cá»§a tÃ´i',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              SizedBox(height: 16),

              _isLoading
                  ? Center(child: CircularProgressIndicator())
                  : _list.isEmpty
                  ? Center(
                      child: Text('ChÆ°a cÃ³ yÃªu cáº§u nÃ o Ä‘Æ°á»£c táº¡o.'),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      physics: NeverScrollableScrollPhysics(),
                      itemCount: _list.length,
                      itemBuilder: (context, index) {
                        final item = _list[index];
                        return Card(
                          margin: EdgeInsets.only(bottom: 10),
                          elevation: 2,
                          child: ListTile(
                            leading: FaIcon(
                              FontAwesomeIcons.flask,
                              color: item.trangThai == 'DA_HOAN_THANH'
                                  ? Colors.green[700]
                                  : Colors.orange[700],
                            ),
                            title: Text(
                              'YC: ${item.maYeuCau} - BN: ${item.tenBN ?? item.maBN}',
                            ),
                            subtitle: Text(
                              'Loáº¡i: ${item.loaiYeuCau} - NgÃ y: ${item.ngayYeuCau}',
                            ),
                            trailing: Chip(
                              label: Text(
                                _displayTrangThai(item.trangThai),
                                style: TextStyle(fontSize: 12),
                              ),
                              backgroundColor: item.trangThai == 'DA_HOAN_THANH'
                                  ? Colors.green[100]
                                  : Colors.orange[100],
                            ),
                          ),
                        );
                      },
                    ),
            ],
          ),
        ),
      ),
    );
  }
}
