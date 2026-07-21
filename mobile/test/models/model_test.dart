import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_p2tb_mobile/models/appointment.dart';
import 'package:hospital_p2tb_mobile/models/user_model.dart';
import 'package:hospital_p2tb_mobile/models/user_profile.dart';

void main() {
  test('UserProfile đọc được tên trường tiếng Việt', () {
    final profile = UserProfile.fromJson({
      'maTK': 'TK01',
      'maBN': 'BN01',
      'hoTen': 'Nguyễn Văn A',
      'email': 'a@example.com',
      'maNhom': 'BENHNHAN',
    });

    expect(profile.patientId, 'BN01');
    expect(profile.role, 'BENHNHAN');
  });

  test('Appointment đọc được số thứ tự', () {
    final appointment = Appointment.fromJson({
      'maLich': 'LK01',
      'maBN': 'BN01',
      'maBS': 'BS01',
      'ngayHen': '2026-07-10',
      'soThuTu': 9,
      'trangThai': 'DA_XAC_NHAN',
    });

    expect(appointment.id, 'LK01');
    expect(appointment.queueNumber, 9);
  });

  test('UserModel đọc được response tài khoản Cognito của Core API', () {
    final user = UserModel.fromJson({
      'username': '79aad56c-example',
      'email': 'patient@example.com',
      'enabled': true,
      'primaryRole': 'BENHNHAN',
      'maTK': 'USER004',
      'maBN': 'BN001',
      'hoTen': 'Bệnh nhân Demo',
    });

    expect(user.username, '79aad56c-example');
    expect(user.tenDangNhap, '79aad56c-example');
    expect(user.maTK, 'USER004');
    expect(user.maNhom, 'BENHNHAN');
    expect(user.maBN, 'BN001');
    expect(user.trangThai, isTrue);
  });
}
