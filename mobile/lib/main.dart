import 'package:amplify_flutter/amplify_flutter.dart' show AmplifyException;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'auth/auth_provider.dart';
import 'config/amplify_bootstrap.dart';
import 'routes/app_router.dart';
import 'theme/app_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  Object? configurationError;
  try {
    await configureAmplify();
  } on AmplifyException catch (error) {
    configurationError = error;
  } on Object catch (error) {
    configurationError = error;
  }

  final authProvider = AuthProvider(autoInitialize: configurationError == null);
  final router = createAppRouter(authProvider);

  runApp(
    ChangeNotifierProvider.value(
      value: authProvider,
      child: HospitalApp(
        router: router,
        configurationError: configurationError,
      ),
    ),
  );
}

class HospitalApp extends StatelessWidget {
  const HospitalApp({
    super.key,
    required this.router,
    this.configurationError,
  });

  final GoRouter router;
  final Object? configurationError;

  @override
  Widget build(BuildContext context) {
    if (configurationError != null) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Hospital P2TB',
        theme: AppTheme.light(),
        home: _ConfigurationErrorScreen(error: configurationError!),
      );
    }

    final auth = context.watch<AuthProvider>();
    if (auth.isLoading) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Hospital P2TB',
        theme: AppTheme.light(),
        home: const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Hospital P2TB',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('vi', 'VN'), Locale('en', 'US')],
      locale: const Locale('vi', 'VN'),
      routerConfig: router,
    );
  }
}

class _ConfigurationErrorScreen extends StatelessWidget {
  const _ConfigurationErrorScreen({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 620),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.cloud_off_rounded,
                        size: 64,
                        color: Colors.red,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Không thể kết nối cấu hình AWS',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        error.toString(),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'Ứng dụng Mobile hiện chỉ chạy với backend thật. '
                        'Tại thư mục gốc, chạy npm run outputs rồi chạy '
                        'mobile/scripts/run-aws.ps1 để truyền CloudFront URL, '
                        'AWS Region, Cognito User Pool và Mobile Client ID.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
