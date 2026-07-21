import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'dart:convert';
import 'package:intl/intl.dart';
import '../../auth/auth_provider.dart';
import '../../services/api_client.dart';

// Model
class YeuCauXN {
  final String maYeuCau;
  final String maBN;
  final String? tenBN;
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
      ).format(DateTime.parse(json['ngayYeuCau']));
    } catch (_) {}

    return YeuCauXN(
      maYeuCau: json['maYeuCau'],
      maBN: json['maBN'],
      tenBN: json['BenhNhan']?['hoTen'] ?? json['maBN'],
      tenBS: json['BacSi']?['hoTen'] ?? 'N/A',
      loaiYeuCau: json['loaiYeuCau'] ?? 'THONG_THUONG',
      trangThai: json['trangThai'] ?? 'CHO_THUC_HIEN',
      ngayYeuCau: fNgay,
    );
  }
}

class YeuCauXNTruocScreen extends StatefulWidget {
  const YeuCauXNTruocScreen({super.key});

  @override
  State<YeuCauXNTruocScreen> createState() => _YeuCauXNTruocScreenState();
}

class _YeuCauXNTruocScreenState extends State<YeuCauXNTruocScreen> {
  final ApiClient _api = ApiClient();
  List<YeuCauXN> _list = [];
  bool _isLoading = true;
  String _selectedFilter = 'CHO_THUC_HIEN'; // Mặc định là 'Chưa thực hiện'

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      // API: GET /api/yeucauxetnghiem (Lấy tất cả yêu cầu)
      final response = await _api.get('/yeucauxetnghiem');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'] as List;
        setState(() {
          _list = data.map((json) => YeuCauXN.fromJson(json)).toList();
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

  // Chuyển đổi trạng thái hiển thị
  String _displayTrangThai(String trangThai) {
    switch (trangThai) {
      case 'CHO_THUC_HIEN':
        return 'Chờ thực hiện';
      case 'DA_LAY_MAU':
        return 'Đã lấy mẫu';
      case 'DA_HOAN_THANH':
        return 'Đã hoàn thành';
      default:
        return trangThai;
    }
  }

  // Chuyển đổi trạng thái yêu cầu
  String _displayLoai(String loai) {
    switch (loai) {
      case 'THONG_THUONG':
        return 'Thông thường';
      case 'KHAN_CAP':
        return 'Khẩn cấp';
      case 'THEO_DOI':
        return 'Theo dõi';
      default:
        return loai;
    }
  }

  Future<void> _handleXacNhanLayMau(String maYeuCau) async {
    try {
      // API: PUT /api/yeucauxetnghiem/:id (Chỉ cập nhật trạng thái)
      await _api.put('/yeucauxetnghiem/$maYeuCau', {'trangThai': 'DA_LAY_MAU'});
      _showSnackbar('✅ Đã xác nhận lấy mẫu!', isError: false);
      _fetchData();
    } catch (e) {
      _showError('Lỗi xác nhận: $e');
    }
  }

  void _showSnackbar(String message, {bool isError = true}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredList = _list
        .where((item) => item.trangThai == _selectedFilter)
        .toList();

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Xử lý Yêu cầu Xét nghiệm'),
        backgroundColor: Colors.indigo[700], // Màu XN
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/xetnghiem'),
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
      body: Column(
        children: [
          // Bộ lọc
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: DropdownButtonFormField<String>(
              decoration: InputDecoration(
                labelText: 'Trạng thái',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              initialValue: _selectedFilter,
              items: ['CHO_THUC_HIEN', 'DA_LAY_MAU', 'DA_HOAN_THANH']
                  .map(
                    (e) => DropdownMenuItem<String>(
                      value: e,
                      child: Text(_displayTrangThai(e)),
                    ),
                  )
                  .toList(),
              onChanged: (v) => setState(() => _selectedFilter = v!),
            ),
          ),

          // Danh sách
          Expanded(
            child: _isLoading
                ? Center(child: CircularProgressIndicator())
                : filteredList.isEmpty
                ? Center(child: Text('Không có yêu cầu nào.'))
                : ListView.builder(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filteredList.length,
                    itemBuilder: (context, index) {
                      final item = filteredList[index];
                      return Card(
                        margin: EdgeInsets.only(bottom: 10),
                        child: ListTile(
                          leading: FaIcon(
                            FontAwesomeIcons.vialCircleCheck,
                            color: item.trangThai == 'CHO_THUC_HIEN'
                                ? Colors.red
                                : Colors.green,
                          ),
                          title: Text(
                            'YC: ${item.maYeuCau} - BN: ${item.tenBN}',
                          ),
                          subtitle: Text(
                            'BS: ${item.tenBS} - Loại: ${_displayLoai(item.loaiYeuCau)}',
                          ),
                          trailing: item.trangThai == 'CHO_THUC_HIEN'
                              ? ElevatedButton(
                                  onPressed: () =>
                                      _handleXacNhanLayMau(item.maYeuCau),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blue,
                                  ),
                                  child: Text('Đã lấy mẫu'),
                                )
                              : Text(
                                  _displayTrangThai(item.trangThai),
                                  style: TextStyle(
                                    color: item.trangThai == 'DA_HOAN_THANH'
                                        ? Colors.green[700]
                                        : Colors.orange,
                                  ),
                                ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
