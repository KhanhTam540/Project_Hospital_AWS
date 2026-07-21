import 'dart:convert';

import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart';

import 'app_config.dart';

/// Kết nối Flutter với Cognito User Pool do AWS CDK tạo.
/// Cấu hình được nhận từ --dart-define; source không chứa secret hoặc JWT.
Future<void> configureAmplify() async {
  if (Amplify.isConfigured) {
    return;
  }

  AppConfig.validate();

  final configuration = jsonEncode({
    'version': '1',
    'auth': {
      'aws_region': AppConfig.awsRegion,
      'user_pool_id': AppConfig.userPoolId,
      'user_pool_client_id': AppConfig.userPoolClientId,
      'username_attributes': ['email'],
      'standard_required_attributes': ['email'],
      'user_verification_types': ['email'],
    },
  });

  await Amplify.addPlugin(AmplifyAuthCognito());

  try {
    await Amplify.configure(configuration);
  } on AmplifyAlreadyConfiguredException {
    safePrint('Amplify đã được cấu hình trước đó.');
  }
}
