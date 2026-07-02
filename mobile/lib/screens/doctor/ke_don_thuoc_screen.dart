// lib/screens/doctor/ke_don_thuoc_screen.dart
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:go_router/go_router.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../auth/auth_provider.dart';
import 'package:intl/intl.dart';
// THÊM: Import cho upload
import 'package:image_picker/image_picker.dart';

// === SỬA 1: Model cho Phiếu Khám (thay vì HSBA) ===
class PhieuKham {
  final String maPK;
  final String maBN;
  final String ngayKham; // Giữ String để hiển thị
  PhieuKham({required this.maPK, required this.maBN, required this.ngayKham});
  factory PhieuKham.fromJson(Map<String, dynamic> json) {
    String fNgay = json['ngayKham'] ?? '';
    try {
      fNgay = DateFormat('dd/MM/yyyy').format(DateTime.parse(json['ngayKham']));
    } catch (_) {}
    return PhieuKham(maPK: json['maPK'], maBN: json['maBN'], ngayKham: fNgay);
  }
}
// === KẾT THÚC SỬA 1 ===

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

  // === SỬA 2: State cho logic mới ===
  List<Map<String, dynamic>> _thuocDaThem = [];
  String? _selectedMaPK;
  // === KẾT THÚC SỬA 2 ===
  // Form chi tiết
  String? _selectedThuoc;
  final _soLuongController = TextEditingController();
  final _lieuDungController = TextEditingController();

  // THÊM: State và Controller cho chức năng Upload
  final ImagePicker _picker = ImagePicker();
  XFile? _selectedImage;
  // KẾT THÚC THÊM

  @override
  void initState() {
    super.initState();
    _maBS = Provider.of<AuthProvider>(context, listen: false).maBS;
    _fetchInitialData();
  }

  Future<void> _fetchInitialData() async {
    if (_maBS == null) {
      _showError("Lỗi: Không tìm thấy Mã Bác Sĩ.");
      return;
    }
    try {
      // Sửa: Lấy phiếu khám theo Bác Sĩ
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
      _showError('Lỗi tải dữ liệu: $e');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
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

  // SỬA: Sửa hàm _handleAddThuoc thành _stageThuoc
  void _stageThuoc() {
    if (!_formKeyChiTiet.currentState!.validate()) return;
    if (_selectedThuoc == null) {
      _showError("Vui lòng chọn thuốc");
      return;
    }

    final selectedThuoc = _thuocList.firstWhere(
      (t) => t.maThuoc == _selectedThuoc,
    );

    setState(() {
      _thuocDaThem.add({
        'maThuoc': _selectedThuoc,
        'tenThuoc': selectedThuoc.tenThuoc, // Lấy cả tên thuốc
        'soLuong': int.parse(_soLuongController.text),
        'lieuDung': _lieuDungController.text,
      });
    });

    // Reset form
    _soLuongController.clear();
    _lieuDungController.clear();
    setState(() => _selectedThuoc = null);
  }

  // SỬA: Hàm mới để xóa thuốc khỏi danh sách tạm
  void _removeThuoc(int index) {
    setState(() {
      _thuocDaThem.removeAt(index);
    });
  }

  // SỬA: Hàm _handleSaveAll để hỗ trợ upload hình ảnh
  Future<void> _handleSaveAll() async {
    if (_selectedMaPK == null) {
      _showError("Vui lòng chọn một phiếu khám");
      return;
    }
    if (_thuocDaThem.isEmpty) {
      _showError("Vui lòng thêm ít nhất 1 loại thuốc");
      return;
    }

    final chiTietJson = jsonEncode(_thuocDaThem);
    final endpoint = '/donthuoc'; // Endpoint chính

    // Payload cho request JSON (nếu không có file)
    final jsonPayload = {
      'maPK': _selectedMaPK,
      'maBS': _maBS,
      'chiTietList': _thuocDaThem,
    };

    // Chuẩn bị fields cho Multipart (khi có file)
    final Map<String, String> multipartFields = {
      'maPK': _selectedMaPK!,
      'maBS': _maBS!,
      'chiTietList':
          chiTietJson, // Gửi chi tiết thuốc dưới dạng JSON string
    };

    try {
      dynamic res;
      if (_selectedImage != null) {
        // Dùng MULTIPART
        res = await _api.postMultipart(
          endpoint,
          multipartFields,
          file: _selectedImage,
          fileFieldName: 'file', // <--- SỬA THÀNH 'file'
        );
      } else {
        // Dùng JSON POST
        res = await _api.post(endpoint, jsonPayload);
      }

      if (res.statusCode == 201) {
        _showError("✅ Đã lưu đơn thuốc thành công!");
        // Reset toàn bộ
        setState(() {
          _thuocDaThem = [];
          _selectedMaPK = null;
          _selectedThuoc = null;
          _selectedImage = null; // Reset ảnh
        });
      } else {
        String errorMessage = 'Lỗi từ server: ${res.statusCode}';
        try {
          final errorBody = jsonDecode(res.body);
          errorMessage = errorBody['message'] ?? errorMessage;
        } catch (_) {}
        _showError(errorMessage);
      }
    } catch (e) {
      _showError('Lỗi khi lưu đơn thuốc: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: Text('Kê đơn thuốc'),
        backgroundColor: Color(0xFF004D40),
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
      body: SingleChildScrollView(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Kê đơn thuốc',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 16),

            // Form chọn Phiếu Khám
            Card(
              elevation: 2,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Chọn Phiếu Khám cần kê đơn',
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
                    _thuocDaThem = []; // Reset khi đổi phiếu
                    _selectedImage = null; // Reset ảnh
                  }),
                  validator: (v) => v == null ? 'Vui lòng chọn' : null,
                ),
              ),
            ),

            if (_selectedMaPK != null) ...[
              SizedBox(height: 24),
              Text(
                'Đang kê đơn cho: $_selectedMaPK',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: Colors.green[700]),
              ),
              SizedBox(height: 16),

              // 2. Thêm thuốc
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
                            labelText: 'Chọn Thuốc',
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
                              v == null ? 'Vui lòng chọn' : null,
                        ),
                        SizedBox(height: 16),
                        TextFormField(
                          controller: _soLuongController,
                          decoration: InputDecoration(
                            labelText: 'Số lượng',
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                          validator: (v) =>
                              v!.isEmpty ? 'Không bỏ trống' : null,
                        ),
                        SizedBox(height: 16),
                        TextFormField(
                          controller: _lieuDungController,
                          decoration: InputDecoration(
                            labelText: 'Liều dùng (vd: Sáng 1, Tối 1)',
                            border: OutlineInputBorder(),
                          ),
                          validator: (v) =>
                              v!.isEmpty ? 'Không bỏ trống' : null,
                        ),
                        SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed:
                              _stageThuoc, // Sửa: gọi hàm _stageThuoc
                          icon: Icon(Icons.add),
                          label: Text('Thêm thuốc vào đơn'),
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

              // THÊM: Vùng chọn ảnh
              Text(
                'Hình ảnh/Chữ ký (Tùy chọn):',
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
                            ? 'Chọn ảnh'
                            : 'Đổi ảnh',
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

              // 3. Danh sách thuốc đã kê (từ state _thuocDaThem)
              Text(
                'Chi tiết đơn thuốc (đang soạn)',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              _thuocDaThem.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24.0),
                      child: Center(
                        child: Text('Chưa có thuốc nào được thêm'),
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
                            subtitle: Text('Liều dùng: ${item['lieuDung']}'),
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
              // Nút Lưu Đơn Thuốc Hoàn Chỉnh
              if (_thuocDaThem.isNotEmpty)
                ElevatedButton.icon(
                  onPressed: _handleSaveAll,
                  icon: Icon(Icons.save),
                  label: Text('Lưu Đơn Thuốc Hoàn Chỉnh'),
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
