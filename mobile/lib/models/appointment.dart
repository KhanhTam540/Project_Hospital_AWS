import 'json_helpers.dart';

class Appointment {
  const Appointment({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.doctorName,
    required this.departmentName,
    required this.date,
    required this.shift,
    required this.status,
    required this.queueNumber,
  });

  final String id;
  final String patientId;
  final String doctorId;
  final String doctorName;
  final String departmentName;
  final DateTime? date;
  final String shift;
  final String status;
  final int queueNumber;

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: readString(json, ['maLich', 'maLH', 'appointmentId', 'id']),
      patientId: readString(json, ['maBN', 'patientId']),
      doctorId: readString(json, ['maBS', 'doctorId']),
      doctorName: readString(json, ['tenBacSi', 'doctorName', 'hoTenBS']),
      departmentName: readString(json, ['tenKhoa', 'departmentName']),
      date: readDate(json, ['ngayHen', 'ngayKham', 'appointmentDate', 'date']),
      shift: readString(json, ['maCa', 'tenCa', 'gioKham', 'shift']),
      status: readString(json, [
        'trangThai',
        'status',
      ], fallback: 'CHO_XAC_NHAN'),
      queueNumber: readInt(json, ['soThuTu', 'queueNumber']),
    );
  }
}
