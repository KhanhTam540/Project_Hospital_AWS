class AppConfig {
  AppConfig._();

  /// Ứng dụng này chỉ chạy với AWS backend thật.

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static const String awsRegion = String.fromEnvironment(
    'AWS_REGION',
    defaultValue: 'ap-southeast-1',
  );

  static const String userPoolId = String.fromEnvironment(
    'COGNITO_USER_POOL_ID',
    defaultValue: '',
  );

  static const String userPoolClientId = String.fromEnvironment(
    'COGNITO_CLIENT_ID',
    defaultValue: '',
  );

  static String get normalizedApiBaseUrl {
    final value = apiBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    if (value.isEmpty) {
      return '';
    }
    return value.endsWith('/api') ? value : '$value/api';
  }

  static void validate() {
    final missing = <String>[];
    if (apiBaseUrl.trim().isEmpty) {
      missing.add('API_BASE_URL');
    }
    if (userPoolId.trim().isEmpty) {
      missing.add('COGNITO_USER_POOL_ID');
    }
    if (userPoolClientId.trim().isEmpty) {
      missing.add('COGNITO_CLIENT_ID');
    }

    if (missing.isNotEmpty) {
      throw StateError(
        'Thiếu cấu hình Mobile: ${missing.join(', ')}. '
        'Hãy chạy npm run outputs rồi chạy mobile/scripts/run-aws.ps1.',
      );
    }

    final apiUri = Uri.tryParse(apiBaseUrl.trim());
    if (apiUri == null ||
        !apiUri.hasScheme ||
        !apiUri.hasAuthority ||
        !const {'https', 'http'}.contains(apiUri.scheme.toLowerCase())) {
      throw StateError(
        'API_BASE_URL không hợp lệ: "$apiBaseUrl". '
        'Giá trị đúng có dạng https://dxxxx.cloudfront.net.',
      );
    }

    final host = apiUri.host.toLowerCase();
    final isLocalHost =
        host == 'localhost' || host == '127.0.0.1' || host == '10.0.2.2';
    if (apiUri.scheme.toLowerCase() != 'https' && !isLocalHost) {
      throw StateError('API_BASE_URL của AWS phải sử dụng HTTPS.');
    }

    if (!RegExp(r'^[a-z]{2}-[a-z]+-\d+$').hasMatch(awsRegion.trim())) {
      throw StateError('AWS_REGION không hợp lệ: "$awsRegion".');
    }

    if (!userPoolId.startsWith('${awsRegion}_')) {
      throw StateError(
        'COGNITO_USER_POOL_ID không thuộc AWS_REGION $awsRegion.',
      );
    }
  }
}
