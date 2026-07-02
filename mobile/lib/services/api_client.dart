import 'dart:async';
import 'dart:convert';

import 'package:cross_file/cross_file.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'auth_service.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient._();

  static final ApiClient _instance = ApiClient._();
  static ApiClient get instance => _instance;

  factory ApiClient() => _instance;

  final AuthService _authService = AuthService.instance;
  static const Duration _requestTimeout = Duration(seconds: 30);

  Uri _resolveUri(String path) {
    if (AppConfig.normalizedApiBaseUrl.isEmpty) {
      throw const ApiException(
        'Chưa cấu hình API_BASE_URL. Hãy chạy mobile/scripts/run-aws.ps1.',
      );
    }

    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('${AppConfig.normalizedApiBaseUrl}$normalizedPath');
  }

  Future<Map<String, String>> _headers({bool isMultipart = false}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (!isMultipart) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }

    final token = await _authService.getIdToken();
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<http.Response> get(String path) {
    return _guard(
      () async => http
          .get(_resolveUri(path), headers: await _headers())
          .timeout(_requestTimeout),
    );
  }

  Future<http.Response> post(String path, Object? body) {
    return _guard(
      () async => http
          .post(
            _resolveUri(path),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_requestTimeout),
    );
  }

  Future<http.Response> put(String path, Object? body) {
    return _guard(
      () async => http
          .put(
            _resolveUri(path),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_requestTimeout),
    );
  }

  Future<http.Response> patch(String path, Object? body) {
    return _guard(
      () async => http
          .patch(
            _resolveUri(path),
            headers: await _headers(),
            body: jsonEncode(body),
          )
          .timeout(_requestTimeout),
    );
  }

  Future<http.Response> delete(String path, {Object? body}) {
    return _guard(
      () async => http
          .delete(
            _resolveUri(path),
            headers: await _headers(),
            body: body == null ? null : jsonEncode(body),
          )
          .timeout(_requestTimeout),
    );
  }

  /// Upload multipart dùng cho các màn hình cũ. Luồng tài liệu y tế mới dùng
  /// pre-signed URL trong HospitalApiService để không chuyển file qua Lambda.
  Future<http.Response> postMultipart(
    String path,
    Map<String, String> fields, {
    XFile? file,
    String fileFieldName = 'hinhAnh',
  }) async {
    return _guard(() async {
      final request = http.MultipartRequest('POST', _resolveUri(path));
      request.headers.addAll(await _headers(isMultipart: true));
      request.fields.addAll(fields);

      if (file != null) {
        request.files.add(
          http.MultipartFile.fromBytes(
            fileFieldName,
            await file.readAsBytes(),
            filename: file.name,
          ),
        );
      }

      final streamed = await request.send().timeout(const Duration(seconds: 60));
      return http.Response.fromStream(streamed);
    });
  }

  Map<String, dynamic> decodeObject(http.Response response) {
    final decoded = _decode(response);
    if (decoded is! Map) {
      throw const FormatException('API không trả về JSON object.');
    }
    return Map<String, dynamic>.from(decoded);
  }

  Object? dataOf(http.Response response) {
    final decoded = _decode(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        _messageOf(decoded, response.statusCode),
        statusCode: response.statusCode,
        code: _codeOf(decoded),
      );
    }

    if (decoded is Map && decoded.containsKey('data')) {
      return decoded['data'];
    }
    return decoded;
  }

  Map<String, dynamic> objectDataOf(http.Response response) {
    final value = dataOf(response);
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    throw const FormatException('API không trả về data object.');
  }

  List<Map<String, dynamic>> listDataOf(http.Response response) {
    final value = dataOf(response);
    if (value is List) {
      return value.whereType<Map>().map(Map<String, dynamic>.from).toList();
    }
    if (value is Map) {
      for (final key in const [
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
      ]) {
        final nested = value[key];
        if (nested is List) {
          return nested
              .whereType<Map>()
              .map(Map<String, dynamic>.from)
              .toList();
        }
      }
    }
    return const [];
  }

  Future<http.Response> _guard(
    Future<http.Response> Function() request,
  ) async {
    try {
      final response = await request();
      return _normalizeUtf8(response);
    } on TimeoutException {
      throw const ApiException(
        'Kết nối đến backend quá thời gian. Vui lòng thử lại.',
      );
    } on http.ClientException catch (error) {
      throw ApiException(
        'Không thể kết nối đến backend: ${error.message}',
      );
    }
  }

  Object? _decode(http.Response response) {
    if (response.bodyBytes.isEmpty) {
      return null;
    }
    final text = utf8.decode(response.bodyBytes, allowMalformed: true).trim();
    if (text.isEmpty) {
      return null;
    }
    try {
      return jsonDecode(text);
    } on FormatException {
      return text;
    }
  }

  String? _codeOf(Object? decoded) {
    if (decoded is! Map) {
      return null;
    }
    final map = Map<String, dynamic>.from(decoded);
    final errorValue = map['error'];
    if (errorValue is Map) {
      final code = errorValue['code'];
      return code?.toString();
    }
    return map['code']?.toString();
  }

  String _messageOf(Object? decoded, int statusCode) {
    if (decoded is Map) {
      final map = Map<String, dynamic>.from(decoded);
      final errorValue = map['error'];
      if (errorValue is Map) {
        final error = Map<String, dynamic>.from(errorValue);
        final message = error['message'];
        if (message != null && message.toString().trim().isNotEmpty) {
          return message.toString();
        }
      }
      for (final value in [map['message'], map['error']]) {
        if (value != null && value.toString().trim().isNotEmpty) {
          return value.toString();
        }
      }
    }
    if (decoded is String && decoded.trim().isNotEmpty) {
      return decoded;
    }
    return 'API trả về lỗi $statusCode.';
  }

  http.Response _normalizeUtf8(http.Response response) {
    return http.Response.bytes(
      response.bodyBytes,
      response.statusCode,
      headers: response.headers,
      request: response.request,
      isRedirect: response.isRedirect,
      persistentConnection: response.persistentConnection,
      reasonPhrase: response.reasonPhrase,
    );
  }
}
