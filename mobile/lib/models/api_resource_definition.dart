import 'package:flutter/material.dart';

import '../auth/auth_provider.dart';

class ApiResourceDefinition {
  const ApiResourceDefinition({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.endpoint,
    required this.primaryKeys,
    required this.secondaryKeys,
    this.statusKeys = const ['status', 'trangThai'],
    this.labels = const {},
    this.emptyMessage = 'Chưa có dữ liệu.',
    this.method = 'GET',
    this.objectMode = false,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String Function(AuthProvider auth) endpoint;
  final List<String> primaryKeys;
  final List<String> secondaryKeys;
  final List<String> statusKeys;
  final Map<String, String> labels;
  final String emptyMessage;
  final String method;
  final bool objectMode;
}

class ApiResources {
  ApiResources._();

  static ApiResourceDefinition doctors = ApiResourceDefinition(
    title: 'Danh sách bác sĩ',
    subtitle: 'Tra cứu bác sĩ, chuyên khoa và khoa phụ trách.',
    icon: Icons.medical_services_rounded,
    endpoint: (_) => '/bacsi',
    primaryKeys: const ['hoTen', 'fullName', 'maBS', 'doctorId'],
    secondaryKeys: const ['chuyenMon', 'specialty', 'tenKhoa', 'maKhoa'],
    labels: const {
      'maBS': 'Mã bác sĩ',
      'doctorId': 'Mã bác sĩ',
      'hoTen': 'Họ tên',
      'fullName': 'Họ tên',
      'chuyenMon': 'Chuyên môn',
      'specialty': 'Chuyên môn',
      'maKhoa': 'Mã khoa',
      'departmentId': 'Mã khoa',
      'trangThai': 'Trạng thái',
      'status': 'Trạng thái',
    },
    emptyMessage: 'Chưa có bác sĩ trong dữ liệu backend.',
  );

  static ApiResourceDefinition staff = ApiResourceDefinition(
    title: 'Danh sách nhân sự',
    subtitle: 'Y tá, tiếp nhận và nhân viên xét nghiệm.',
    icon: Icons.badge_rounded,
    endpoint: (_) => '/nhansu',
    primaryKeys: const ['hoTen', 'fullName', 'maNS', 'staffId'],
    secondaryKeys: const ['loaiNS', 'staffType', 'tenKhoa', 'maKhoa'],
    labels: const {
      'maNS': 'Mã nhân sự',
      'staffId': 'Mã nhân sự',
      'hoTen': 'Họ tên',
      'fullName': 'Họ tên',
      'loaiNS': 'Loại nhân sự',
      'staffType': 'Loại nhân sự',
      'maKhoa': 'Mã khoa',
      'departmentId': 'Mã khoa',
      'trangThai': 'Trạng thái',
      'status': 'Trạng thái',
    },
    emptyMessage: 'Chưa có nhân sự trong dữ liệu backend.',
  );

  static ApiResourceDefinition departments = ApiResourceDefinition(
    title: 'Khoa chuyên môn',
    subtitle: 'Danh mục khoa đang hoạt động trong bệnh viện.',
    icon: Icons.apartment_rounded,
    endpoint: (_) => '/khoa',
    primaryKeys: const ['tenKhoa', 'departmentName', 'maKhoa', 'departmentId'],
    secondaryKeys: const ['moTa', 'description'],
    labels: const {
      'maKhoa': 'Mã khoa',
      'departmentId': 'Mã khoa',
      'tenKhoa': 'Tên khoa',
      'departmentName': 'Tên khoa',
      'moTa': 'Mô tả',
      'description': 'Mô tả',
      'trangThai': 'Trạng thái',
      'status': 'Trạng thái',
    },
    emptyMessage: 'Chưa có khoa chuyên môn.',
  );

  static ApiResourceDefinition rooms = ApiResourceDefinition(
    title: 'Phòng khám',
    subtitle: 'Danh sách phòng khám và khoa quản lý.',
    icon: Icons.meeting_room_rounded,
    endpoint: (_) => '/phongkham',
    primaryKeys: const ['tenPhong', 'roomName', 'maPhong', 'roomId'],
    secondaryKeys: const ['maKhoa', 'departmentId'],
    labels: const {
      'maPhong': 'Mã phòng',
      'roomId': 'Mã phòng',
      'tenPhong': 'Tên phòng',
      'roomName': 'Tên phòng',
      'maKhoa': 'Mã khoa',
      'departmentId': 'Mã khoa',
      'trangThai': 'Trạng thái',
      'status': 'Trạng thái',
    },
    emptyMessage: 'Chưa có phòng khám.',
  );

  static ApiResourceDefinition schedules = ApiResourceDefinition(
    title: 'Lịch làm việc',
    subtitle: 'Lịch làm việc và ca trực theo tài khoản hiện tại.',
    icon: Icons.event_available_rounded,
    endpoint: (auth) {
      if (auth.role == 'BACSI' && (auth.maBS ?? '').isNotEmpty) {
        return '/lichlamviec/bacsi/${auth.maBS}';
      }
      if (auth.role == 'NHANSU' && (auth.maNS ?? '').isNotEmpty) {
        return '/lichlamviec/nhansu/${auth.maNS}';
      }
      return '/lichlamviec';
    },
    primaryKeys: const ['ngayLamViec', 'workDate', 'scheduleId', 'maLichLV'],
    secondaryKeys: const ['tenCa', 'maCa', 'gioBatDau', 'gioKetThuc'],
    labels: const {
      'scheduleId': 'Mã lịch',
      'maLichLV': 'Mã lịch',
      'ngayLamViec': 'Ngày làm việc',
      'workDate': 'Ngày làm việc',
      'maCa': 'Mã ca',
      'shiftId': 'Mã ca',
      'gioBatDau': 'Bắt đầu',
      'startTime': 'Bắt đầu',
      'gioKetThuc': 'Kết thúc',
      'endTime': 'Kết thúc',
    },
    emptyMessage: 'Chưa có lịch làm việc.',
  );

  static ApiResourceDefinition shifts = ApiResourceDefinition(
    title: 'Ca trực',
    subtitle: 'Danh mục ca làm việc hiện có.',
    icon: Icons.access_time_filled_rounded,
    endpoint: (_) => '/catruc',
    primaryKeys: const ['tenCa', 'maCa'],
    secondaryKeys: const ['gioBatDau', 'gioKetThuc'],
    labels: const {
      'maCa': 'Mã ca',
      'tenCa': 'Tên ca',
      'gioBatDau': 'Giờ bắt đầu',
      'gioKetThuc': 'Giờ kết thúc',
    },
    emptyMessage: 'Chưa có ca trực.',
  );

  static ApiResourceDefinition medicines = ApiResourceDefinition(
    title: 'Danh mục thuốc',
    subtitle: 'Tra cứu thuốc đang có trong dữ liệu bệnh viện.',
    icon: Icons.medication_rounded,
    endpoint: (_) => '/thuoc',
    primaryKeys: const ['tenThuoc', 'medicineName', 'maThuoc', 'medicineId'],
    secondaryKeys: const ['donViTinh', 'unit', 'soLuongTon', 'stockQuantity'],
    labels: const {
      'maThuoc': 'Mã thuốc',
      'medicineId': 'Mã thuốc',
      'tenThuoc': 'Tên thuốc',
      'medicineName': 'Tên thuốc',
      'donViTinh': 'Đơn vị tính',
      'unit': 'Đơn vị tính',
      'soLuongTon': 'Tồn kho',
      'stockQuantity': 'Tồn kho',
      'giaBan': 'Giá bán',
      'salePrice': 'Giá bán',
    },
    emptyMessage: 'Chưa có thuốc trong danh mục.',
  );

  static ApiResourceDefinition medicineUnits = ApiResourceDefinition(
    title: 'Đơn vị tính',
    subtitle: 'Đơn vị sử dụng trong danh mục thuốc.',
    icon: Icons.straighten_rounded,
    endpoint: (_) => '/thuoc/donvitinh',
    primaryKeys: const ['tenDVT', 'label', 'value', 'maDVT'],
    secondaryKeys: const ['maDVT', 'value'],
    labels: const {
      'maDVT': 'Mã đơn vị',
      'tenDVT': 'Tên đơn vị',
      'label': 'Nhãn',
      'value': 'Giá trị',
    },
  );

  static ApiResourceDefinition medicineGroups = ApiResourceDefinition(
    title: 'Nhóm thuốc',
    subtitle: 'Phân nhóm các loại thuốc.',
    icon: Icons.category_rounded,
    endpoint: (_) => '/thuoc/nhomthuoc',
    primaryKeys: const ['tenNhomThuoc', 'maNhomThuoc'],
    secondaryKeys: const ['description', 'moTa'],
    labels: const {
      'maNhomThuoc': 'Mã nhóm',
      'tenNhomThuoc': 'Tên nhóm',
      'description': 'Mô tả',
      'moTa': 'Mô tả',
    },
  );

  static ApiResourceDefinition labCatalog = ApiResourceDefinition(
    title: 'Danh mục xét nghiệm',
    subtitle: 'Các loại xét nghiệm backend hiện cung cấp.',
    icon: Icons.biotech_rounded,
    endpoint: (_) => '/xetnghiem',
    primaryKeys: const ['tenXN', 'testName', 'maXN', 'testId'],
    secondaryKeys: const ['moTa', 'description'],
    emptyMessage: 'Backend hiện chưa có dữ liệu danh mục xét nghiệm.',
  );

  static ApiResourceDefinition labRequests = ApiResourceDefinition(
    title: 'Yêu cầu xét nghiệm',
    subtitle: 'Danh sách yêu cầu xét nghiệm đang xử lý.',
    icon: Icons.assignment_rounded,
    endpoint: (_) => '/yeucauxetnghiem',
    primaryKeys: const ['maYeuCau', 'requestId', 'tenXetNghiem'],
    secondaryKeys: const ['maBN', 'patientId', 'ngayYeuCau', 'createdAt'],
    emptyMessage: 'Backend hiện chưa có dữ liệu yêu cầu xét nghiệm.',
  );

  static ApiResourceDefinition invoiceList = ApiResourceDefinition(
    title: 'Danh sách hóa đơn',
    subtitle: 'Các hóa đơn y tế đã phát sinh.',
    icon: Icons.receipt_long_rounded,
    endpoint: (_) => '/hoadon',
    primaryKeys: const ['maHD', 'invoiceId', 'noiDung'],
    secondaryKeys: const ['tongTien', 'totalAmount', 'ngayLap', 'createdAt'],
    emptyMessage: 'Module hóa đơn backend hiện chưa có dữ liệu.',
  );

  static ApiResourceDefinition invoiceStatistics = ApiResourceDefinition(
    title: 'Thống kê hóa đơn',
    subtitle: 'Tổng hợp tình trạng hóa đơn từ backend.',
    icon: Icons.query_stats_rounded,
    endpoint: (_) => '/hoadon/thongke',
    primaryKeys: const ['message', 'tongTien'],
    secondaryKeys: const ['tongSo', 'daThanhToan', 'chuaThanhToan'],
    objectMode: true,
    emptyMessage: 'Chưa có thống kê hóa đơn.',
  );
}
