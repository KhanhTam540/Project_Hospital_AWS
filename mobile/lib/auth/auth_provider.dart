import 'dart:async';

import 'package:amplify_flutter/amplify_flutter.dart' show AuthSignInStep;
import 'package:flutter/foundation.dart';

import '../services/api_client.dart';
import '../services/auth_service.dart';

/// Trạng thái xác thực dùng chung cho toàn bộ ứng dụng.
///
/// Cognito/Amplify quản lý token và tự làm mới phiên. Provider chỉ giữ hồ sơ
/// nghiệp vụ trả về từ GET /api/me; không ghi JWT vào SharedPreferences.
class AuthProvider extends ChangeNotifier {
  AuthProvider({bool autoInitialize = true}) {
    if (autoInitialize) {
      unawaited(initialize());
    } else {
      _isLoading = false;
    }
  }

  final AuthService _authService = AuthService.instance;
  final ApiClient _api = ApiClient();

  String? _role;
  String? _maTK;
  String? _tenDangNhap;
  String? _email;
  String? _maBN;
  String? _maBS;
  String? _maNS;
  String? _loaiNS;
  bool _isAuthenticated = false;
  bool _isLoading = true;
  String? _initializationError;

  String? get role => _role;
  String? get maTK => _maTK;
  String? get tenDangNhap => _tenDangNhap;
  String? get email => _email;
  String? get maBN => _maBN;
  String? get maBS => _maBS;
  String? get maNS => _maNS;
  String? get loaiNS => _loaiNS;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get initializationError => _initializationError;

  Future<void> initialize() async {
    _setLoading(true);
    _initializationError = null;

    try {
      if (await _authService.isSignedIn()) {
        await refreshProfile(notify: false);
      } else {
        _clearProfile();
      }
    } catch (error) {
      _initializationError = _authService.messageFor(error);
      _clearProfile();
    } finally {
      _setLoading(false);
    }
  }

  Future<AuthSignInStep?> signIn({
    required String email,
    required String password,
  }) async {
    final result = await _authService.signIn(email: email, password: password);
    if (result.isSignedIn) {
      await refreshProfile();
      return null;
    }
    return result.nextStep.signInStep;
  }

  Future<AuthSignInStep?> confirmSignIn(String confirmationValue) async {
    final result = await _authService.confirmSignIn(confirmationValue);
    if (result.isSignedIn) {
      await refreshProfile();
      return null;
    }
    return result.nextStep.signInStep;
  }

  Future<void> refreshProfile({bool notify = true}) async {
    final response = await _api.get('/me');
    final data = _api.objectDataOf(response);

    _applyProfile(data);
    _isAuthenticated = true;
    _initializationError = null;

    if (notify) {
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _authService.signOut();
    } finally {
      _clearProfile();
      notifyListeners();
    }
  }

  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) {
    return _authService.updatePassword(
      oldPassword: oldPassword,
      newPassword: newPassword,
    );
  }

  void _applyProfile(Map<String, dynamic> user) {
    _role = _text(
      user['maNhom'] ?? user['primaryRole'] ?? user['role'],
    )?.toUpperCase();
    _maTK = _text(user['maTK'] ?? user['appUserId'] ?? user['sub']);
    _maBN = _text(user['maBN'] ?? user['patientId']);
    _maBS = _text(user['maBS'] ?? user['doctorId']);
    _maNS = _text(user['maNS'] ?? user['staffId']);
    _loaiNS = _text(user['loaiNS'] ?? user['staffType'])?.toUpperCase();
    _email = _text(user['email']);
    _tenDangNhap = _text(
      user['hoTen'] ??
          user['fullName'] ??
          user['tenDangNhap'] ??
          user['username'] ??
          user['email'],
    );
  }

  void _clearProfile() {
    _role = null;
    _maTK = null;
    _tenDangNhap = null;
    _email = null;
    _maBN = null;
    _maBS = null;
    _maNS = null;
    _loaiNS = null;
    _isAuthenticated = false;
  }

  void _setLoading(bool value) {
    if (_isLoading == value) {
      return;
    }
    _isLoading = value;
    notifyListeners();
  }

  String? _text(Object? value) {
    if (value == null) {
      return null;
    }
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }
}
