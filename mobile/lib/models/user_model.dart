class UserModel {
  const UserModel({
    required this.maTK,
    required this.username,
    required this.tenDangNhap,
    this.email,
    required this.maNhom,
    required this.trangThai,
    this.hoTen,
    this.maKhoa,
    this.tenKhoa,
    this.chuyenMon,
    this.maBS,
    this.chucVu,
    this.trinhDo,
    this.maNS,
    this.loaiNS,
    this.capBac,
    this.maBN,
    this.gioiTinh,
    this.ngaySinh,
    this.soDienThoai,
    this.bhyt,
    this.diaChi,
  });

  /// Mã tài khoản nghiệp vụ trong DynamoDB.
  final String maTK;

  /// Cognito username dùng cho các API quản trị tài khoản.
  final String username;
  final String tenDangNhap;
  final String? email;
  final String maNhom;
  final bool trangThai;

  final String? hoTen;
  final String? maKhoa;
  final String? tenKhoa;
  final String? chuyenMon;
  final String? maBS;
  final String? chucVu;
  final String? trinhDo;
  final String? maNS;
  final String? loaiNS;
  final String? capBac;
  final String? maBN;
  final String? gioiTinh;
  final String? ngaySinh;
  final String? soDienThoai;
  final String? bhyt;
  final String? diaChi;

  factory UserModel.fromJson(Map<String, dynamic> json) {
    String text(Object? value, {String fallback = ''}) {
      final result = value?.toString().trim() ?? '';
      return result.isEmpty ? fallback : result;
    }

    bool parseEnabled(Object? value) {
      if (value is bool) return value;
      if (value is num) return value != 0;
      final normalized = text(value).toUpperCase();
      return const {'TRUE', '1', 'ACTIVE', 'ENABLED', 'CONFIRMED'}
          .contains(normalized);
    }

    final username = text(
      json['username'] ?? json['cognitoUsername'] ?? json['tenDangNhap'],
      fallback: text(json['maTK'], fallback: 'N/A'),
    );
    final fullName = text(
      json['hoTen'] ?? json['fullName'] ?? json['name'],
      fallback: username,
    );

    return UserModel(
      maTK: text(
        json['maTK'] ?? json['appUserId'] ?? json['id'],
        fallback: username,
      ),
      username: username,
      tenDangNhap: username,
      email: text(json['email']).isEmpty ? null : text(json['email']),
      maNhom: text(
        json['maNhom'] ?? json['primaryRole'] ?? json['role'],
        fallback: 'CHUA_PHAN_QUYEN',
      ).toUpperCase(),
      trangThai: parseEnabled(
        json['enabled'] ?? json['trangThai'] ?? json['status'],
      ),
      hoTen: fullName,
      maKhoa: text(json['maKhoa'] ?? json['departmentId']).isEmpty
          ? null
          : text(json['maKhoa'] ?? json['departmentId']),
      tenKhoa: text(json['tenKhoa'] ?? json['departmentName']).isEmpty
          ? null
          : text(json['tenKhoa'] ?? json['departmentName']),
      chuyenMon: text(json['chuyenMon'] ?? json['specialty']).isEmpty
          ? null
          : text(json['chuyenMon'] ?? json['specialty']),
      maBS: text(json['maBS'] ?? json['doctorId']).isEmpty
          ? null
          : text(json['maBS'] ?? json['doctorId']),
      chucVu: text(json['chucVu'] ?? json['position']).isEmpty
          ? null
          : text(json['chucVu'] ?? json['position']),
      trinhDo: text(json['trinhDo'] ?? json['degree']).isEmpty
          ? null
          : text(json['trinhDo'] ?? json['degree']),
      maNS: text(json['maNS'] ?? json['staffId']).isEmpty
          ? null
          : text(json['maNS'] ?? json['staffId']),
      loaiNS: text(json['loaiNS'] ?? json['staffType']).isEmpty
          ? null
          : text(json['loaiNS'] ?? json['staffType']).toUpperCase(),
      capBac: text(json['capBac'] ?? json['rank']).isEmpty
          ? null
          : text(json['capBac'] ?? json['rank']),
      maBN: text(json['maBN'] ?? json['patientId']).isEmpty
          ? null
          : text(json['maBN'] ?? json['patientId']),
      gioiTinh: text(json['gioiTinh'] ?? json['gender']).isEmpty
          ? null
          : text(json['gioiTinh'] ?? json['gender']),
      ngaySinh: text(json['ngaySinh'] ?? json['dateOfBirth']).isEmpty
          ? null
          : text(json['ngaySinh'] ?? json['dateOfBirth']),
      soDienThoai: text(json['soDienThoai'] ?? json['phoneNumber']).isEmpty
          ? null
          : text(json['soDienThoai'] ?? json['phoneNumber']),
      bhyt: text(json['bhyt'] ?? json['healthInsuranceNumber']).isEmpty
          ? null
          : text(json['bhyt'] ?? json['healthInsuranceNumber']),
      diaChi: text(json['diaChi'] ?? json['address']).isEmpty
          ? null
          : text(json['diaChi'] ?? json['address']),
    );
  }
}
