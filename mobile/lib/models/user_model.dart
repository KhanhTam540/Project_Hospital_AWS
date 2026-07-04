class UserModel {
  const UserModel({
    required this.username,
    required this.maTK,
    required this.maNhom,
    required this.trangThai,
    this.email,
    this.hoTen,
    this.maBN,
    this.maBS,
    this.maNS,
    this.maKhoa,
    this.tenKhoa,
    this.loaiNS,
    this.chuyenMon,
    this.capBac,
    this.trinhDo,
    this.chucVu,
    this.diaChi,
    this.soDienThoai,
    this.bhyt,
    this.gioiTinh,
    this.ngaySinh,
    this.confirmationStatus,
  });

  /// Cognito username.
  ///
  /// Các API quản trị tài khoản phải dùng trường này,
  /// không dùng maTK để gọi Cognito.
  final String username;

  /// Mã hồ sơ ứng dụng lưu trong DynamoDB.
  final String maTK;

  final String maNhom;
  final bool trangThai;

  final String? email;
  final String? hoTen;

  final String? maBN;
  final String? maBS;
  final String? maNS;

  final String? maKhoa;
  final String? tenKhoa;

  final String? loaiNS;
  final String? chuyenMon;
  final String? capBac;
  final String? trinhDo;
  final String? chucVu;

  final String? diaChi;
  final String? soDienThoai;
  final String? bhyt;
  final String? gioiTinh;
  final String? ngaySinh;

  final String? confirmationStatus;

  /// Tương thích với các màn hình cũ.
  String get tenDangNhap => username;

  bool get enabled => trangThai;

  static String? _nullableString(dynamic value) {
    if (value == null) {
      return null;
    }

    final result = value.toString().trim();

    if (result.isEmpty || result.toLowerCase() == 'null') {
      return null;
    }

    return result;
  }

  static bool _readEnabled(Map<String, dynamic> json) {
    final value = json['enabled'] ?? json['trangThai'] ?? json['status'];

    if (value is bool) {
      return value;
    }

    if (value is num) {
      return value != 0;
    }

    final normalized = value?.toString().trim().toUpperCase();

    if (normalized == null || normalized.isEmpty) {
      return true;
    }

    return !const {
      'FALSE',
      '0',
      'DISABLED',
      'INACTIVE',
      'LOCKED',
    }.contains(normalized);
  }

  static String _readRole(Map<String, dynamic> json) {
    final direct = _nullableString(
      json['maNhom'] ?? json['primaryRole'] ?? json['role'],
    );

    if (direct != null) {
      return direct.toUpperCase();
    }

    final groups = json['groups'];

    if (groups is List && groups.isNotEmpty) {
      return groups.first.toString().toUpperCase();
    }

    return 'BENHNHAN';
  }

  static String? _readDepartmentName(Map<String, dynamic> json) {
    final direct = _nullableString(json['tenKhoa'] ?? json['departmentName']);

    if (direct != null) {
      return direct;
    }

    final department = json['Khoa'] ?? json['department'];

    if (department is Map) {
      final departmentMap = Map<String, dynamic>.from(department);

      return _nullableString(
        departmentMap['tenKhoa'] ??
            departmentMap['departmentName'] ??
            departmentMap['name'],
      );
    }

    return null;
  }

  factory UserModel.fromJson(Map<String, dynamic> json) {
    final username =
        _nullableString(
          json['username'] ?? json['tenDangNhap'] ?? json['cognitoUsername'],
        ) ??
        '';

    final appUserId =
        _nullableString(json['maTK'] ?? json['userId'] ?? json['id']) ??
        username;

    return UserModel(
      username: username,
      maTK: appUserId,
      maNhom: _readRole(json),
      trangThai: _readEnabled(json),

      email: _nullableString(json['email']),

      hoTen: _nullableString(json['hoTen'] ?? json['fullName'] ?? json['name']),

      maBN: _nullableString(json['maBN'] ?? json['patientId']),

      maBS: _nullableString(json['maBS'] ?? json['doctorId']),

      maNS: _nullableString(json['maNS'] ?? json['staffId']),

      maKhoa: _nullableString(json['maKhoa'] ?? json['departmentId']),

      tenKhoa: _readDepartmentName(json),

      loaiNS: _nullableString(json['loaiNS'] ?? json['staffType']),

      chuyenMon: _nullableString(json['chuyenMon'] ?? json['specialty']),

      capBac: _nullableString(json['capBac'] ?? json['rank']),

      trinhDo: _nullableString(json['trinhDo'] ?? json['degree']),

      chucVu: _nullableString(json['chucVu'] ?? json['position']),

      diaChi: _nullableString(json['diaChi'] ?? json['address']),

      soDienThoai: _nullableString(
        json['soDienThoai'] ?? json['phoneNumber'] ?? json['phone_number'],
      ),

      bhyt: _nullableString(
        json['bhyt'] ??
            json['healthInsurance'] ??
            json['healthInsuranceNumber'],
      ),

      gioiTinh: _nullableString(json['gioiTinh'] ?? json['gender']),

      ngaySinh: _nullableString(json['ngaySinh'] ?? json['birthDate']),

      confirmationStatus: _nullableString(
        json['confirmationStatus'] ?? json['userStatus'],
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'username': username,
      'tenDangNhap': username,
      'maTK': maTK,
      'maNhom': maNhom,
      'enabled': trangThai,
      'trangThai': trangThai,

      'email': email,
      'hoTen': hoTen,

      'maBN': maBN,
      'maBS': maBS,
      'maNS': maNS,

      'maKhoa': maKhoa,
      'tenKhoa': tenKhoa,

      'loaiNS': loaiNS,
      'chuyenMon': chuyenMon,
      'capBac': capBac,
      'trinhDo': trinhDo,
      'chucVu': chucVu,

      'diaChi': diaChi,
      'soDienThoai': soDienThoai,
      'bhyt': bhyt,
      'gioiTinh': gioiTinh,
      'ngaySinh': ngaySinh,

      'confirmationStatus': confirmationStatus,
    };
  }

  UserModel copyWith({
    String? username,
    String? maTK,
    String? maNhom,
    bool? trangThai,
    String? email,
    String? hoTen,
    String? maBN,
    String? maBS,
    String? maNS,
    String? maKhoa,
    String? tenKhoa,
    String? loaiNS,
    String? chuyenMon,
    String? capBac,
    String? trinhDo,
    String? chucVu,
    String? diaChi,
    String? soDienThoai,
    String? bhyt,
    String? gioiTinh,
    String? ngaySinh,
    String? confirmationStatus,
  }) {
    return UserModel(
      username: username ?? this.username,
      maTK: maTK ?? this.maTK,
      maNhom: maNhom ?? this.maNhom,
      trangThai: trangThai ?? this.trangThai,
      email: email ?? this.email,
      hoTen: hoTen ?? this.hoTen,
      maBN: maBN ?? this.maBN,
      maBS: maBS ?? this.maBS,
      maNS: maNS ?? this.maNS,
      maKhoa: maKhoa ?? this.maKhoa,
      tenKhoa: tenKhoa ?? this.tenKhoa,
      loaiNS: loaiNS ?? this.loaiNS,
      chuyenMon: chuyenMon ?? this.chuyenMon,
      capBac: capBac ?? this.capBac,
      trinhDo: trinhDo ?? this.trinhDo,
      chucVu: chucVu ?? this.chucVu,
      diaChi: diaChi ?? this.diaChi,
      soDienThoai: soDienThoai ?? this.soDienThoai,
      bhyt: bhyt ?? this.bhyt,
      gioiTinh: gioiTinh ?? this.gioiTinh,
      ngaySinh: ngaySinh ?? this.ngaySinh,
      confirmationStatus: confirmationStatus ?? this.confirmationStatus,
    );
  }
}
