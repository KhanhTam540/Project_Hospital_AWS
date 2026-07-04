import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'api_client.dart';

class HospitalApiService {
  HospitalApiService({ApiClient? api}) : _api = api ?? ApiClient();

  final ApiClient _api;

  Future<Map<String, dynamic>> getObject(String path) async {
    final response = await _api.get(path);
    final value = _api.dataOf(response);
    return _asObject(value);
  }

  Future<List<Map<String, dynamic>>> getCollection(
    String path, {
    List<String> nestedKeys = const [],
  }) async {
    final response = await _api.get(path);
    final value = _api.dataOf(response);
    return _asCollection(value, nestedKeys: nestedKeys);
  }

  Future<Map<String, dynamic>> postObject(String path, Object? body) async {
    final response = await _api.post(path, body);
    final value = _api.dataOf(response);
    return _asObject(value);
  }

  Future<Map<String, dynamic>> putObject(String path, Object? body) async {
    final response = await _api.put(path, body);
    final value = _api.dataOf(response);
    return _asObject(value);
  }

  Future<Map<String, dynamic>> deleteObject(String path, {Object? body}) async {
    final response = await _api.delete(path, body: body);
    final value = _api.dataOf(response);
    return _asObject(value);
  }

  Future<Map<String, dynamic>> health() => getObject('/health');
  Future<Map<String, dynamic>> me() => getObject('/me');
  Future<Map<String, dynamic>> adminPing() => getObject('/admin/ping');

  Future<List<Map<String, dynamic>>> accounts() async {
    return getCollection('/tai-khoan', nestedKeys: const ['users']);
  }

  Future<Map<String, dynamic>> accountSummary() async {
    final response = await _api.get('/tai-khoan');
    final value = _api.dataOf(response);
    if (value is List) {
      final items = value
          .whereType<Map>()
          .map(Map<String, dynamic>.from)
          .toList();
      int countRole(String role) => items.where((item) {
        final current = (item['primaryRole'] ?? item['maNhom'] ?? item['role'])
            ?.toString()
            .toUpperCase();
        return current == role;
      }).length;
      return {
        'admin': countRole('ADMIN'),
        'doctor': countRole('BACSI'),
        'staff': countRole('NHANSU'),
        'patient': countRole('BENHNHAN'),
      };
    }
    final object = _asObject(value);
    final summary = object['summary'];
    return summary is Map ? Map<String, dynamic>.from(summary) : const {};
  }

  Future<Map<String, dynamic>> updateAccountRole(String username, String role) {
    return putObject('/tai-khoan/${Uri.encodeComponent(username)}', {
      'role': role,
      'maNhom': role,
    });
  }

  Future<Map<String, dynamic>> disableAccount(String username) {
    return deleteObject('/tai-khoan/${Uri.encodeComponent(username)}');
  }

  Future<List<Map<String, dynamic>>> patients() => getCollection('/benhnhan');

  Future<Map<String, dynamic>> patient(String patientId) =>
      getObject('/benhnhan/${Uri.encodeComponent(patientId)}');

  Future<Map<String, dynamic>> patientCore(String patientId) =>
      getObject('/patients/${Uri.encodeComponent(patientId)}');

  Future<Map<String, dynamic>> patientByAccount(String accountId) =>
      getObject('/benhnhan/findByMaTK/${Uri.encodeComponent(accountId)}');

  Future<Map<String, dynamic>> createPatient(Map<String, dynamic> body) =>
      postObject('/patients', body);

  Future<Map<String, dynamic>> updatePatient(
    String patientId,
    Map<String, dynamic> body,
  ) => putObject('/patients/${Uri.encodeComponent(patientId)}', body);

  Future<List<Map<String, dynamic>>> doctors() => getCollection('/bacsi');
  Future<List<Map<String, dynamic>>> staff() => getCollection('/nhansu');
  Future<List<Map<String, dynamic>>> departments() => getCollection('/khoa');
  Future<List<Map<String, dynamic>>> rooms() => getCollection('/phongkham');
  Future<List<Map<String, dynamic>>> shifts() => getCollection('/catruc');
  Future<List<Map<String, dynamic>>> schedules() =>
      getCollection('/lichlamviec');

  Future<List<Map<String, dynamic>>> appointments({
    String? patientId,
    String? doctorId,
  }) {
    if (patientId != null && patientId.isNotEmpty) {
      return getCollection(
        '/lichkham/benhnhan/${Uri.encodeComponent(patientId)}',
      );
    }
    if (doctorId != null && doctorId.isNotEmpty) {
      return getCollection('/lichkham/bacsi/${Uri.encodeComponent(doctorId)}');
    }
    return getCollection('/lichkham');
  }

  Future<Map<String, dynamic>> appointment(String appointmentId) =>
      getObject('/lichkham/${Uri.encodeComponent(appointmentId)}');

  Future<Map<String, dynamic>> createAppointment(Map<String, dynamic> body) =>
      postObject('/lichkham', body);

  Future<Map<String, dynamic>> cancelAppointment(String appointmentId) =>
      deleteObject('/lichkham/${Uri.encodeComponent(appointmentId)}');

  Future<List<Map<String, dynamic>>> records(String patientId) => getCollection(
    '/patients/${Uri.encodeComponent(patientId)}/records',
    nestedKeys: const ['items', 'records'],
  );

  Future<Map<String, dynamic>> createRecord(
    String patientId,
    Map<String, dynamic> body,
  ) => postObject('/patients/${Uri.encodeComponent(patientId)}/records', body);

  Future<List<Map<String, dynamic>>> examinations(String patientId) =>
      getCollection(
        '/patients/${Uri.encodeComponent(patientId)}/examinations',
        nestedKeys: const ['items', 'examinations'],
      );

  Future<Map<String, dynamic>> createExamination(
    String patientId,
    Map<String, dynamic> body,
  ) => postObject(
    '/patients/${Uri.encodeComponent(patientId)}/examinations',
    body,
  );

  Future<List<Map<String, dynamic>>> prescriptions(String patientId) =>
      getCollection(
        '/patients/${Uri.encodeComponent(patientId)}/prescriptions',
        nestedKeys: const ['items', 'prescriptions'],
      );

  Future<Map<String, dynamic>> createPrescription(
    String patientId,
    Map<String, dynamic> body,
  ) => postObject(
    '/patients/${Uri.encodeComponent(patientId)}/prescriptions',
    body,
  );

  Future<List<Map<String, dynamic>>> documents(String patientId) =>
      getCollection(
        '/patients/${Uri.encodeComponent(patientId)}/documents',
        nestedKeys: const ['items', 'documents'],
      );

  Future<Map<String, dynamic>> createUploadUrl({
    required String patientId,
    required String fileName,
    required String contentType,
    required int fileSize,
  }) {
    return postObject('/medical/upload-url', {
      'patientId': patientId,
      'fileName': fileName,
      'contentType': contentType,
      'fileSize': fileSize,
    });
  }

  Future<void> uploadToPresignedUrl({
    required String uploadUrl,
    required Uint8List bytes,
    required Map<String, String> headers,
  }) async {
    final response = await http.put(
      Uri.parse(uploadUrl),
      headers: headers,
      body: bytes,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        'Không thể tải tệp lên S3 (${response.statusCode}).',
        statusCode: response.statusCode,
      );
    }
  }

  Future<Map<String, dynamic>> completeUpload(String documentId) =>
      postObject('/medical/complete-upload', {'documentId': documentId});

  Future<Map<String, dynamic>> downloadUrl(String documentId) => getObject(
    '/medical/download-url?documentId=${Uri.encodeQueryComponent(documentId)}',
  );

  Future<List<Map<String, dynamic>>> labResults({String? patientId}) {
    final suffix = patientId == null || patientId.isEmpty
        ? ''
        : '?maBN=${Uri.encodeQueryComponent(patientId)}';
    return getCollection('/phieuxetnghiem$suffix');
  }

  Future<Map<String, dynamic>> labResult(String labResultId) =>
      getObject('/phieuxetnghiem/${Uri.encodeComponent(labResultId)}');

  Future<List<Map<String, dynamic>>> medicines() => getCollection('/thuoc');
  Future<List<Map<String, dynamic>>> medicineUnits() =>
      getCollection('/thuoc/donvitinh');
  Future<List<Map<String, dynamic>>> medicineGroups() =>
      getCollection('/thuoc/nhomthuoc');

  Future<List<Map<String, dynamic>>> invoices() => getCollection('/hoadon');
  Future<Map<String, dynamic>> invoiceStatistics() =>
      getObject('/hoadon/thongke');

  Future<List<Map<String, dynamic>>> testCatalog() =>
      getCollection('/xetnghiem');
  Future<List<Map<String, dynamic>>> testRequests() =>
      getCollection('/yeucauxetnghiem');

  Future<Map<String, dynamic>> aiChat(String message) => postObject(
    '/ai/chat',
    {'message': message, 'context': 'Hospital P2TB mobile application'},
  );

  Future<Map<String, dynamic>> aiSummary(Map<String, dynamic> context) =>
      postObject('/ai/summary', {
        'message': 'Hãy tóm tắt thông tin y tế được cung cấp.',
        'context': jsonEncode(context),
      });

  List<Map<String, dynamic>> _asCollection(
    Object? value, {
    List<String> nestedKeys = const [],
  }) {
    if (value is List) {
      return value.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }

    if (value is Map) {
      final map = Map<String, dynamic>.from(value);
      final keys = <String>[
        ...nestedKeys,
        'items',
        'users',
        'records',
        'results',
        'appointments',
        'patients',
        'doctors',
        'staff',
        'departments',
        'rooms',
        'schedules',
        'examinations',
        'prescriptions',
        'documents',
        'labResults',
        'khoa',
        'bacsi',
        'benhNhan',
        'lichKham',
      ];
      for (final key in keys) {
        final nested = map[key];
        if (nested is List) {
          return nested
              .whereType<Map>()
              .map(Map<String, dynamic>.from)
              .toList();
        }
      }
      if (map.isNotEmpty) return [map];
    }

    return const [];
  }

  Map<String, dynamic> _asObject(Object? value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    if (value is List && value.isNotEmpty && value.first is Map) {
      return Map<String, dynamic>.from(value.first as Map);
    }
    return const {};
  }
}
