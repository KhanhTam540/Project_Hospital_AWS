// lib/screens/doctor/phieu_kham_bs_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'package:go_router/go_router.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
// SỬA: Import thanh điều hướng
import 'doctor_bottom_nav_bar.dart';
// THÊM: Import cho upload
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

// === Model HSBA (cần maBN) ===
class HSBAModel {
  final String maHSBA;
  final String maBN;
  final dynamic benhNhan; // 'BenhNhan' object lồng vào (nếu có)

  HSBAModel({required this.maHSBA, required this.maBN, this.benhNhan});

  factory HSBAModel.fromJson(Map<String, dynamic> json) {
    return HSBAModel(
      maHSBA: json['maHSBA'],
      maBN: json['maBN'],
      benhNhan: json['BenhNhan'],
    );
  }
}

// SỬA: Sửa lại tên class (bỏ chữ 'n' thừa)
class PhieuKhamBSScreenn extends StatefulWidget {
  const PhieuKhamBSScreenn({super.key});

  @override
  State<PhieuKhamBSScreenn> createState() => _PhieuKhamBSScreenState();
}

// SỬA: Sửa lại tên class
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
  String? _selectedBN; // Tự động điền
  bool _isSubmitting = false;

  // THÊM: State và Controller cho chức năng Upload
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  // KẾT THÚC THÊM

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    if (_maBS != null) {
      _loadAllData(); // Gọi hàm tải chung
    } else {
      setState(() => _isLoading = false);
      _showError("Lỗi: Không tìm thấy mã Bác sĩ.");
    }
  }

  // Hàm tải chung cho cả Form và List
  Future<void> _loadAllData() async {
    setState(() {
      _isLoading = true;
      _isLoadingDropdowns = true;
    });
    try {
      await Future.wait([_fetchData(), _loadDropdownData()]);
    } catch (e) {
      _showError("Lỗi tải dữ liệu tổng hợp: $e");
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
    // Không set isLoading ở đây nữa
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
      _showError('Lỗi tải phiếu khám: $e');
    }
  }

  Future<void> _loadDropdownData() async {
    // Không set isLoading ở đây nữa
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
        _showError('Lỗi tải danh sách HSBA');
      }
    } catch (e) {
      _showError('Lỗi tải danh sách Bệnh nhân/HSBA');
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

  // THÊM: Hàm chọn ảnh
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
  // KẾT THÚC THÊM

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

  // SỬA: Cập nhật hàm _handleCreate để sử dụng postMultipart
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
      final endpoint = '/phieukham'; // Endpoint chính

      if (_selectedImage != null) {
        // Dùng MULTIPART (SỬA: fileFieldName = 'file')
        final Map<String, String> fields = payload.map(
          (k, v) => MapEntry(k, v?.toString() ?? ''),
        );

        response = await _api.postMultipart(
          endpoint,
          fields,
          file: _selectedImage,
          fileFieldName: 'file', // <--- SỬA THÀNH 'file' để khớp với backend
        );
      } else {
        // Dùng JSON POST
        response = await _api.post(endpoint, payload);
      }

      if (response.statusCode == 201) {
        _showSuccess('Tạo phiếu khám thành công!');
        _fetchData();
        _inlineFormKey.currentState?.reset();
        _trieuChungController.clear();
        _chuanDoanController.clear();
        _loiDanController.clear();
        setState(() {
          _selectedHSBA = null;
          _selectedBN = null;
          _selectedImage = null; // Reset ảnh
        });
      } else {
        String errorMessage = 'Lỗi lưu: ${response.statusCode}';
        try {
          final errorBody = jsonDecode(response.body);
          errorMessage = errorBody['message'] ?? errorMessage;
        } catch (_) {}
        _showError(errorMessage);
      }
    } catch (e) {
      _showError('Lỗi kết nối: $e');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _handleDelete(String maPK) async {
    bool? confirm = await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Xác nhận xóa'),
        content: Text('Bạn có chắc chắn muốn xóa phiếu khám này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Không'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Đồng ý'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final res = await _api.delete('/phieukham/$maPK');
      if (res.statusCode == 200) {
        _showSuccess("Xóa phiếu thành công!");
        _fetchData();
      } else {
        _showError("Lỗi: Không thể xóa phiếu.");
      }
    } catch (e) {
      _showError("Lỗi kết nối khi xóa.");
    }
  }

  @override
  Widget build(BuildContext context) {
    // SỬA: Thêm Scaffold, AppBar, và BottomNav
    return Scaffold(
      backgroundColor: Colors.grey[100], // Đồng bộ màu nền
      appBar: AppBar(
        title: Text('Phiếu khám bệnh'),
        backgroundColor: Color(0xFF004D40), // Màu xanh đậm của bác sĩ
        actions: [
          IconButton(
            icon: FaIcon(FontAwesomeIcons.house, color: Colors.white, size: 20),
            tooltip: 'Trang chủ',
            onPressed: () => context.go('/doctor'),
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
      body: RefreshIndicator(
        onRefresh: _loadAllData, // Dùng hàm tải chung
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Form inline
              Padding(
                padding: const EdgeInsets.all(16.0).copyWith(bottom: 0),
                child: Text(
                  'Tạo phiếu khám bệnh',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              _buildInlineForm(), // Widget Form
              // Danh sách
              Padding(
                padding: const EdgeInsets.all(16.0).copyWith(bottom: 8, top: 8),
                child: Text(
                  'Lịch sử phiếu khám',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
                ),
              ),
              (_isLoading || _isLoadingDropdowns) // Sửa: Gộp 2 cờ loading
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
                        child: Text('Chưa có phiếu khám nào.'),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _phieuKhams.length,
                      shrinkWrap: true,
                      physics: NeverScrollableScrollPhysics(),
                      itemBuilder: (context, index) {
                        final phieu = _phieuKhams[index];

                        // An toàn hơn: tìm tên BN
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
                              'Chẩn đoán: ${phieu.chuanDoan ?? "Chưa có"}',
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
                                  tooltip: 'Xóa phiếu',
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
      // SỬA: Thêm Bottom Nav Bar, index = 3
      bottomNavigationBar: DoctorBottomNavBar(currentIndex: 3),
    );
  }

  // === THAY THẾ TOÀN BỘ HÀM NÀY (Có tích hợp Upload) ===
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
              // 1. Chọn HSBA
              DropdownButtonFormField<String>(
                decoration: InputDecoration(
                  labelText: 'Chọn HSBA',
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
                validator: (v) => v == null ? 'Vui lòng chọn' : null,
              ),
              SizedBox(height: 12),

              // 2. Bệnh nhân (Tự động điền)
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
                  labelText: 'Bệnh nhân',
                  border: OutlineInputBorder(),
                  filled: _selectedBN != null,
                  fillColor: Colors.grey[100],
                ),
              ),
              SizedBox(height: 12),

              // 3. Triệu chứng
              TextFormField(
                controller: _trieuChungController,
                decoration: InputDecoration(
                  labelText: 'Triệu chứng',
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Không được bỏ trống' : null,
              ),
              SizedBox(height: 12),

              // 4. Chẩn đoán
              TextFormField(
                controller: _chuanDoanController,
                decoration: InputDecoration(
                  labelText: 'Chẩn đoán',
                  border: OutlineInputBorder(),
                ),
                validator: (v) =>
                    (v == null || v.isEmpty) ? 'Không được bỏ trống' : null,
              ),
              SizedBox(height: 12),

              // 5. Lời dặn
              TextFormField(
                controller: _loiDanController,
                decoration: InputDecoration(
                  labelText: 'Lời dặn',
                  border: OutlineInputBorder(),
                ),
              ),

              // THÊM: Vùng chọn ảnh
              SizedBox(height: 16),
              Text(
                'Hình ảnh đính kèm (Tùy chọn):',
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
                        _selectedImage == null ? 'Chọn ảnh' : 'Đổi ảnh',
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
                              'Đã chọn: ${_selectedImage!.name}',
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
              // KẾT THÚC THÊM

              // 6. Nút Lưu
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
                label: Text(_isSubmitting ? 'Đang lưu...' : 'Lưu phiếu khám'),
                style: ElevatedButton.styleFrom(
                  minimumSize: Size(double.infinity, 44),
                  backgroundColor:
                      Colors.blue[800], // Màu xanh dương (giống trang web)
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ), // Bo góc nút
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
