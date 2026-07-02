// lib/screens/doctor/lich_lam_viec_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'doctor_bottom_nav_bar.dart';

// Model
class CaTruc {
  final String maCa;
  final String tenCa;
  CaTruc({required this.maCa, required this.tenCa});
  factory CaTruc.fromJson(Map<String, dynamic> json) =>
      CaTruc(maCa: json['maCa'], tenCa: json['tenCa']);
}

// THÃŠM: Model cho NhÃ¢n Sá»± Y Táº¿
class NhanSuYTe {
  final String maNS;
  final String hoTen;
  NhanSuYTe({required this.maNS, required this.hoTen});
  factory NhanSuYTe.fromJson(Map<String, dynamic> json) =>
      NhanSuYTe(maNS: json['maNS'], hoTen: json['hoTen']);
}

class LichLamViec {
  final String maLichLV;
  final String maCa;
  final String ngayLamViec;
  // THÃŠM: ThÃªm maNS Ä‘á»ƒ hiá»ƒn thá»‹
  final String? maNS;

  LichLamViec({
    required this.maLichLV,
    required this.maCa,
    required this.ngayLamViec,
    this.maNS,
  });

  factory LichLamViec.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayLamViec'] ?? '';
    try {
      fNgay = DateFormat(
        'dd/MM/yyyy',
      ).format(DateTime.parse(json['ngayLamViec']));
    } catch (_) {}
    return LichLamViec(
      maLichLV: json['maLichLV'],
      maCa: json['maCa'],
      ngayLamViec: fNgay,
      maNS: json['maNS'], // THÃŠM
    );
  }
}

class LichLamViecBSScreen extends StatefulWidget {
  const LichLamViecBSScreen({super.key});

  @override
  State<LichLamViecBSScreen> createState() => _LichLamViecBSScreenState();
}

class _LichLamViecBSScreenState extends State<LichLamViecBSScreen> {
  final ApiClient _api = ApiClient();
  final _formKey = GlobalKey<FormState>();

  List<LichLamViec> _list = [];
  List<CaTruc> _caList = [];
  // THÃŠM: State cho danh sÃ¡ch vÃ  má»¥c Ä‘Ã£ chá»n cá»§a NhÃ¢n Sá»±
  List<NhanSuYTe> _nhanSuList = [];
  bool _isLoading = true;
  String? _maBS;

  // Form
  String? _selectedCa;
  // THÃŠM: State cho NhÃ¢n sá»± Ä‘Ã£ chá»n
  String? _selectedNS;
  DateTime? _selectedDate;

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _selectedDate = DateTime.now();
    _fetchInitialData();
  }

  Future<void> _fetchInitialData() async {
    if (_maBS == null) {
      setState(() => _isLoading = false);
      return;
    }
    setState(() => _isLoading = true);
    try {
      // THÃŠM: Gá»i thÃªm API /nhansu
      final resLich = await _api.get('/lichlamviec/bacsi/$_maBS');
      final resCa = await _api.get('/catruc');
      final resNS = await _api.get('/nhansu'); // THÃŠM

      setState(() {
        _list = (jsonDecode(resLich.body)['data'] as List)
            .map((j) => LichLamViec.fromJson(j))
            .toList();
        _caList = (jsonDecode(resCa.body)['data'] as List)
            .map((j) => CaTruc.fromJson(j))
            .toList();
        // THÃŠM: GÃ¡n dá»¯ liá»‡u cho _nhanSuList
        _nhanSuList = (jsonDecode(resNS.body)['data'] as List)
            .map((j) => NhanSuYTe.fromJson(j))
            .toList();
      });
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

  Future<void> _handleCreate() async {
    if (!_formKey.currentState!.validate()) return;
    try {
      // Sá»¬A: Bá»• sung 'maNS' vÃ o body
      await _api.post('/lichlamviec', {
        'maBS': _maBS,
        'maCa': _selectedCa,
        'ngayLamViec': DateFormat('yyyy-MM-dd').format(_selectedDate!),
        'maNS': _selectedNS, // THÃŠM
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('âœ… ÄÃ£ thÃªm lá»‹ch'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchInitialData(); // Táº£i láº¡i
    } catch (e) {
      _showError('Lá»—i: KhÃ´ng thá»ƒ thÃªm lá»‹ch');
    }
  }

  Future<void> _handleDelete(String maLichLV) async {
    // ThÃªm dialog xÃ¡c nháº­n
    try {
      await _api.delete('/lichlamviec/$maLichLV');
      _fetchInitialData();
    } catch (e) {
      _showError('Lá»—i: KhÃ´ng thá»ƒ xoÃ¡');
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sá»¬A: ThÃªm Scaffold vÃ  AppBar
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Lá»‹ch lÃ m viá»‡c'),
        backgroundColor: Color(0xFF004D40), // MÃ u BÃ¡c sÄ©
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
              'ÄÄƒng kÃ½ Lá»‹ch lÃ m viá»‡c',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            // Form
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      _buildDateField(
                        context,
                        'Chá»n ngÃ y',
                        _selectedDate,
                        (v) => setState(() => _selectedDate = v),
                      ),
                      SizedBox(height: 16),
                      DropdownButtonFormField<String>(
                        decoration: InputDecoration(
                          labelText: 'Chá»n ca',
                          border: OutlineInputBorder(),
                        ),
                        initialValue: _selectedCa,
                        items: _caList
                            .map(
                              (ca) => DropdownMenuItem<String>(
                                value: ca.maCa,
                                child: Text(ca.tenCa),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _selectedCa = v),
                        validator: (v) =>
                            v == null ? 'Vui lÃ²ng chá»n ca' : null,
                      ),
                      SizedBox(height: 16), // THÃŠM
                      // THÃŠM: Dropdown chá»n NhÃ¢n Sá»±
                      DropdownButtonFormField<String>(
                        decoration: InputDecoration(
                          labelText: 'Chá»n nhÃ¢n sá»± phá»¥ trÃ¡ch',
                          border: OutlineInputBorder(),
                        ),
                        initialValue: _selectedNS,
                        items: _nhanSuList
                            .map(
                              (ns) => DropdownMenuItem<String>(
                                value: ns.maNS,
                                child: Text(ns.hoTen),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => setState(() => _selectedNS = v),
                        validator: (v) =>
                            v == null ? 'Vui lÃ²ng chá»n nhÃ¢n sá»±' : null,
                      ),
                      SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: _handleCreate,
                        icon: Icon(Icons.add),
                        label: Text('ÄÄƒng kÃ½ ca'),
                        style: ElevatedButton.styleFrom(
                          minimumSize: Size(double.infinity, 44),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'Lá»‹ch Ä‘Ã£ Ä‘Äƒng kÃ½',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),
            // Danh sÃ¡ch
            _isLoading
                ? Center(child: CircularProgressIndicator())
                : ListView.builder(
                    shrinkWrap: true,
                    physics: NeverScrollableScrollPhysics(),
                    itemCount: _list.length,
                    itemBuilder: (context, index) {
                      final item = _list[index];
                      return Card(
                        margin: EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: FaIcon(
                            FontAwesomeIcons.calendarDay,
                            color: Colors.blue,
                          ),
                          title: Text('NgÃ y: ${item.ngayLamViec}'),
                          // Sá»¬A: Hiá»ƒn thá»‹ cáº£ Ca vÃ  NhÃ¢n sá»±
                          subtitle: Text(
                            'Ca: ${item.maCa} - NhÃ¢n sá»±: ${item.maNS ?? 'N/A'}',
                          ),
                          trailing: IconButton(
                            icon: Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () => _handleDelete(item.maLichLV),
                          ),
                        ),
                      );
                    },
                  ),
          ],
        ),
      ),
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 1),
    );
  }

  // (Helper cho DateField)
  Widget _buildDateField(
    BuildContext context,
    String label,
    DateTime? date,
    Function(DateTime?) onChanged,
  ) {
    return TextFormField(
      readOnly: true,
      controller: TextEditingController(
        text: date == null ? '' : DateFormat('dd/MM/yyyy').format(date),
      ),
      decoration: InputDecoration(
        labelText: label,
        border: OutlineInputBorder(),
        suffixIcon: Icon(Icons.calendar_today),
      ),
      onTap: () async {
        DateTime? picked = await showDatePicker(
          context: context,
          initialDate: date ?? DateTime.now(),
          firstDate: DateTime.now(),
          lastDate: DateTime.now().add(Duration(days: 60)),
        );
        if (picked != null) onChanged(picked);
      },
      validator: (v) =>
          v == null || v.isEmpty ? '$label lÃ  báº¯t buá»™c' : null,
    );
  }
}
