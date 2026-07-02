import 'json_helpers.dart';

class UserProfile {
  const UserProfile({
    required this.accountId,
    required this.fullName,
    required this.email,
    required this.role,
    required this.patientId,
    this.phone = '',
    this.address = '',
    this.insuranceNumber = '',
    this.dateOfBirth,
    this.gender = '',
  });

  final String accountId;
  final String fullName;
  final String email;
  final String role;
  final String patientId;
  final String phone;
  final String address;
  final String insuranceNumber;
  final DateTime? dateOfBirth;
  final String gender;

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      accountId: readString(json, ['maTK', 'appUserId', 'sub', 'accountId']),
      fullName: readString(json, [
        'hoTen',
        'fullName',
        'name',
        'tenDangNhap',
        'username',
        'email',
      ], fallback: 'Bệnh nhân'),
      email: readString(json, ['email']),
      role: readString(json, [
        'maNhom',
        'primaryRole',
        'role',
      ], fallback: 'BENHNHAN').toUpperCase(),
      patientId: readString(json, ['maBN', 'patientId']),
      phone: readString(json, ['soDienThoai', 'phone']),
      address: readString(json, ['diaChi', 'address']),
      insuranceNumber: readString(json, ['bhyt', 'insuranceNumber']),
      dateOfBirth: readDate(json, ['ngaySinh', 'dateOfBirth']),
      gender: readString(json, ['gioiTinh', 'gender']),
    );
  }

  UserProfile copyWith({
    String? fullName,
    String? phone,
    String? address,
    String? insuranceNumber,
    DateTime? dateOfBirth,
    String? gender,
  }) {
    return UserProfile(
      accountId: accountId,
      fullName: fullName ?? this.fullName,
      email: email,
      role: role,
      patientId: patientId,
      phone: phone ?? this.phone,
      address: address ?? this.address,
      insuranceNumber: insuranceNumber ?? this.insuranceNumber,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      gender: gender ?? this.gender,
    );
  }
}
