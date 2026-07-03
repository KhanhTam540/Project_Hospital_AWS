import 'package:flutter/material.dart';

import '../../widgets/hospital_ui.dart';

class _ApiEntry {
  const _ApiEntry(this.method, this.path, this.screen, this.note);
  final String method;
  final String path;
  final String screen;
  final String note;
}

class ApiCatalogScreen extends StatefulWidget {
  const ApiCatalogScreen({super.key});

  @override
  State<ApiCatalogScreen> createState() => _ApiCatalogScreenState();
}

class _ApiCatalogScreenState extends State<ApiCatalogScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  static const List<_ApiEntry> _entries = [
    _ApiEntry('GET', '/health', 'Tổng quan', 'Kiểm tra backend công khai'),
    _ApiEntry('GET', '/me', 'Hồ sơ cá nhân', 'Thông tin tài khoản hiện tại'),
    _ApiEntry('GET', '/auth/me', 'Hồ sơ cá nhân', 'Alias thông tin tài khoản'),
    _ApiEntry('GET', '/admin/ping', 'Tổng quan Admin', 'Kiểm tra quyền ADMIN'),
    _ApiEntry(
      'GET',
      '/tai-khoan',
      'Tài khoản',
      'Danh sách và thống kê tài khoản',
    ),
    _ApiEntry('PUT', '/tai-khoan/{username}', 'Tài khoản', 'Cập nhật vai trò'),
    _ApiEntry(
      'DELETE',
      '/tai-khoan/{username}',
      'Tài khoản',
      'Vô hiệu hóa tài khoản',
    ),
    _ApiEntry('POST', '/patients', 'Bệnh nhân', 'Tạo bệnh nhân'),
    _ApiEntry(
      'GET',
      '/patients/{patientId}',
      'Bệnh nhân',
      'Chi tiết bệnh nhân',
    ),
    _ApiEntry(
      'PUT',
      '/patients/{patientId}',
      'Bệnh nhân/Hồ sơ',
      'Cập nhật bệnh nhân',
    ),
    _ApiEntry(
      'GET',
      '/patients/{patientId}/records',
      'Hồ sơ lâm sàng',
      'Danh sách bệnh án',
    ),
    _ApiEntry(
      'POST',
      '/patients/{patientId}/records',
      'Hồ sơ lâm sàng',
      'Tạo bệnh án',
    ),
    _ApiEntry(
      'GET',
      '/patients/{patientId}/examinations',
      'Hồ sơ lâm sàng',
      'Phiếu khám',
    ),
    _ApiEntry(
      'POST',
      '/patients/{patientId}/examinations',
      'Hồ sơ lâm sàng',
      'Tạo phiếu khám',
    ),
    _ApiEntry(
      'GET',
      '/patients/{patientId}/prescriptions',
      'Hồ sơ lâm sàng',
      'Đơn thuốc',
    ),
    _ApiEntry(
      'POST',
      '/patients/{patientId}/prescriptions',
      'Hồ sơ lâm sàng',
      'Tạo đơn thuốc',
    ),
    _ApiEntry(
      'GET',
      '/patients/{patientId}/documents',
      'Hồ sơ lâm sàng',
      'Tài liệu y tế',
    ),
    _ApiEntry(
      'POST',
      '/medical/upload-url',
      'Hồ sơ lâm sàng',
      'Tạo URL tải lên S3',
    ),
    _ApiEntry(
      'POST',
      '/medical/complete-upload',
      'Hồ sơ lâm sàng',
      'Xác nhận tải lên',
    ),
    _ApiEntry(
      'GET',
      '/medical/download-url',
      'Hồ sơ lâm sàng',
      'Tạo URL tải xuống',
    ),
    _ApiEntry('POST', '/ai/chat', 'Trợ lý AI', 'Chat Gemini qua backend'),
    _ApiEntry('POST', '/ai/summary', 'Trợ lý AI', 'Tóm tắt nội dung'),
    _ApiEntry('GET', '/benhnhan', 'Bệnh nhân', 'Danh sách tương thích'),
    _ApiEntry(
      'GET',
      '/benhnhan/{patientId}',
      'Bệnh nhân',
      'Chi tiết tương thích',
    ),
    _ApiEntry(
      'GET',
      '/benhnhan/findByMaTK/{maTK}',
      'Hồ sơ cá nhân',
      'Ánh xạ tài khoản-bệnh nhân',
    ),
    _ApiEntry('GET', '/bacsi', 'Bác sĩ', 'Danh sách bác sĩ'),
    _ApiEntry(
      'GET',
      '/bacsi/maTK/{maTK}',
      'Hồ sơ cá nhân',
      'Ánh xạ tài khoản-bác sĩ',
    ),
    _ApiEntry(
      'GET',
      '/bacsi/tk/{maTK}',
      'Hồ sơ cá nhân',
      'Alias ánh xạ bác sĩ',
    ),
    _ApiEntry('GET', '/nhansu', 'Nhân sự', 'Danh sách nhân sự'),
    _ApiEntry(
      'GET',
      '/nhansu/maTK/{maTK}',
      'Hồ sơ cá nhân',
      'Ánh xạ tài khoản-nhân sự',
    ),
    _ApiEntry('GET', '/khoa', 'Khoa', 'Danh sách khoa'),
    _ApiEntry('GET', '/phongkham', 'Phòng khám', 'Danh sách phòng'),
    _ApiEntry('GET', '/lichkham', 'Lịch khám', 'Danh sách toàn hệ thống'),
    _ApiEntry('POST', '/lichkham', 'Lịch khám', 'Tạo lịch khám'),
    _ApiEntry('GET', '/lichkham/{appointmentId}', 'Lịch khám', 'Chi tiết lịch'),
    _ApiEntry('DELETE', '/lichkham/{appointmentId}', 'Lịch khám', 'Hủy lịch'),
    _ApiEntry(
      'GET',
      '/lichkham/benhnhan/{patientId}',
      'Lịch khám',
      'Lịch của bệnh nhân',
    ),
    _ApiEntry(
      'GET',
      '/lichkham/bacsi/{doctorId}',
      'Lịch khám',
      'Lịch của bác sĩ',
    ),
    _ApiEntry(
      'GET',
      '/hsba',
      'Hồ sơ lâm sàng',
      'Danh sách bệnh án tương thích',
    ),
    _ApiEntry(
      'GET',
      '/hsba/benhnhan/{patientId}',
      'Hồ sơ lâm sàng',
      'Bệnh án theo bệnh nhân',
    ),
    _ApiEntry('GET', '/phieukham', 'Hồ sơ lâm sàng', 'Danh sách phiếu khám'),
    _ApiEntry(
      'GET',
      '/phieukham/nurse/queue',
      'Hồ sơ lâm sàng',
      'Hàng đợi điều dưỡng',
    ),
    _ApiEntry('GET', '/donthuoc', 'Hồ sơ lâm sàng', 'Danh sách đơn thuốc'),
    _ApiEntry('GET', '/thuoc', 'Dược', 'Danh mục thuốc'),
    _ApiEntry('GET', '/thuoc/donvitinh', 'Dược', 'Đơn vị tính'),
    _ApiEntry('GET', '/thuoc/nhomthuoc', 'Dược', 'Nhóm thuốc'),
    _ApiEntry('GET', '/lichlamviec', 'Lịch làm việc', 'Danh sách lịch'),
    _ApiEntry(
      'GET',
      '/lichlamviec/bacsi/{doctorId}',
      'Lịch làm việc',
      'Lịch bác sĩ',
    ),
    _ApiEntry(
      'GET',
      '/lichlamviec/nhansu/{staffId}',
      'Lịch làm việc',
      'Lịch nhân sự',
    ),
    _ApiEntry('GET', '/catruc', 'Lịch làm việc', 'Danh mục ca trực'),
    _ApiEntry('GET', '/hoadon', 'Hóa đơn', 'Danh sách hóa đơn'),
    _ApiEntry('GET', '/hoadon/thongke', 'Hóa đơn', 'Thống kê hóa đơn'),
    _ApiEntry('GET', '/xetnghiem', 'Xét nghiệm', 'Danh mục xét nghiệm'),
    _ApiEntry('GET', '/yeucauxetnghiem', 'Xét nghiệm', 'Yêu cầu xét nghiệm'),
    _ApiEntry('GET', '/phieuxetnghiem', 'Xét nghiệm', 'Danh sách kết quả'),
    _ApiEntry(
      'GET',
      '/phieuxetnghiem/{labResultId}',
      'Xét nghiệm',
      'Chi tiết kết quả',
    ),
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<_ApiEntry> get _visible {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) return _entries;
    return _entries.where((entry) {
      return '${entry.method} ${entry.path} ${entry.screen} ${entry.note}'
          .toLowerCase()
          .contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visible;
    final groups = <String, List<_ApiEntry>>{};
    for (final entry in visible) {
      groups.putIfAbsent(entry.screen, () => []).add(entry);
    }

    return HospitalPage(
      children: [
        const PageHeader(
          title: 'Danh mục API và giao diện',
          subtitle:
              'Đối chiếu toàn bộ route backend hiện có với màn hình Mobile mới.',
          icon: Icons.hub_rounded,
          badge: StatusBadge('ĐÃ ÁNH XẠ'),
        ),
        const SizedBox(height: 22),
        ResponsiveGrid(
          children: [
            MetricCard(
              label: 'Tổng API',
              value: '${_entries.length}',
              icon: Icons.api_rounded,
            ),
            MetricCard(
              label: 'Nhóm giao diện',
              value: '${{for (final item in _entries) item.screen}.length}',
              icon: Icons.dashboard_customize_rounded,
              color: Colors.indigo,
            ),
            MetricCard(
              label: 'API ghi dữ liệu',
              value: '${_entries.where((e) => e.method != 'GET').length}',
              icon: Icons.edit_note_rounded,
              color: Colors.orange,
            ),
          ],
        ),
        const SizedBox(height: 20),
        SearchField(
          controller: _searchController,
          hint: 'Tìm route, method hoặc màn hình...',
          onChanged: (value) => setState(() => _query = value),
        ),
        const SizedBox(height: 18),
        for (final group in groups.entries) ...[
          SectionTitle(
            title: group.key,
            subtitle: '${group.value.length} API đã có giao diện',
          ),
          const SizedBox(height: 10),
          HospitalCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              children: [
                for (var index = 0; index < group.value.length; index++) ...[
                  ListTile(
                    leading: EndpointBadge(
                      method: group.value[index].method,
                      path: group.value[index].path,
                    ),
                    title: Text(group.value[index].note),
                    subtitle: Text(group.value[index].path),
                    trailing: const Icon(
                      Icons.check_circle_rounded,
                      color: Colors.green,
                    ),
                  ),
                  if (index < group.value.length - 1) const Divider(height: 1),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
        ],
      ],
    );
  }
}
