import 'package:go_router/go_router.dart';

import '../auth/auth_provider.dart';
import '../models/api_resource_definition.dart';
import '../screens/auth/confirm_email_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/error/not_found_screen.dart';
import '../screens/redesign/account_management_screen.dart';
import '../screens/redesign/ai_assistant_screen.dart';
import '../screens/redesign/api_catalog_screen.dart';
import '../screens/redesign/api_resource_screen.dart';
import '../screens/redesign/appointment_workspace_screen.dart';
import '../screens/redesign/billing_screen.dart';
import '../screens/redesign/clinical_hub_screen.dart';
import '../screens/redesign/dashboard_screen.dart';
import '../screens/redesign/hospital_shell.dart';
import '../screens/redesign/laboratory_screen.dart';
import '../screens/redesign/patient_directory_screen.dart';
import '../screens/redesign/pharmacy_screen.dart';
import '../screens/redesign/profile_screen.dart';
import '../screens/redesign/schedule_screen.dart';

const _publicPaths = <String>{
  '/login',
  '/register',
  '/forgot-password',
  '/confirm-email',
};

String _normalizedRole(AuthProvider auth) => (auth.role ?? '').toUpperCase();

bool _canAccess(AuthProvider auth, String path) {
  final role = _normalizedRole(auth);
  if (role == 'ADMIN') return true;

  const shared = <String>{
    '/home',
    '/doctors',
    '/departments',
    '/appointments',
    '/clinical',
    '/laboratory',
    '/ai',
    '/profile',
  };
  if (shared.contains(path)) return true;

  if (role == 'BACSI') {
    return const <String>{
      '/patients',
      '/schedules',
      '/pharmacy',
    }.contains(path);
  }

  if (role == 'BENHNHAN') {
    return const <String>{'/billing'}.contains(path);
  }

  if (role == 'NHANSU') {
    return const <String>{
      '/patients',
      '/staff',
      '/rooms',
      '/schedules',
      '/pharmacy',
    }.contains(path);
  }

  return path == '/home' || path == '/profile';
}

GoRouter createAppRouter(AuthProvider auth) {
  return GoRouter(
    refreshListenable: auth,
    initialLocation: '/',
    errorBuilder: (context, state) => const NotFoundScreen(),
    redirect: (context, state) {
      final path = state.uri.path;
      final isPublic = _publicPaths.contains(path);

      if (auth.isLoading) return null;
      if (!auth.isAuthenticated && !isPublic) return '/login';
      if (auth.isAuthenticated && (isPublic || path == '/')) return '/home';

      const aliases = <String>{
        '/admin',
        '/doctor',
        '/patient',
        '/yta',
        '/tiepnhan',
        '/xetnghiem',
      };
      if (auth.isAuthenticated && aliases.contains(path)) return '/home';
      if (path == '/chatbot' || path == '/chat/list') return '/ai';

      if (auth.isAuthenticated &&
          path.startsWith('/') &&
          !_canAccess(auth, path)) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (context, state) => auth.isAuthenticated ? '/home' : '/login',
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/confirm-email',
        builder: (context, state) => ConfirmEmailScreen(
          initialEmail: state.uri.queryParameters['email'] ?? '',
        ),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => ForgotPasswordScreen(
          initialEmail: state.uri.queryParameters['email'] ?? '',
        ),
      ),
      for (final alias in const <String>[
        '/admin',
        '/doctor',
        '/patient',
        '/yta',
        '/tiepnhan',
        '/xetnghiem',
        '/chatbot',
        '/chat/list',
      ])
        GoRoute(
          path: alias,
          redirect: (context, state) =>
              alias.startsWith('/chat') ? '/ai' : '/home',
        ),
      ShellRoute(
        builder: (context, state, child) =>
            HospitalShell(currentPath: state.uri.path, child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: DashboardScreen()),
          ),
          GoRoute(
            path: '/accounts',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: AccountManagementScreen()),
          ),
          GoRoute(
            path: '/patients',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: PatientDirectoryScreen()),
          ),
          GoRoute(
            path: '/doctors',
            pageBuilder: (context, state) => NoTransitionPage(
              child: ApiResourceScreen(definition: ApiResources.doctors),
            ),
          ),
          GoRoute(
            path: '/staff',
            pageBuilder: (context, state) => NoTransitionPage(
              child: ApiResourceScreen(definition: ApiResources.staff),
            ),
          ),
          GoRoute(
            path: '/departments',
            pageBuilder: (context, state) => NoTransitionPage(
              child: ApiResourceScreen(definition: ApiResources.departments),
            ),
          ),
          GoRoute(
            path: '/rooms',
            pageBuilder: (context, state) => NoTransitionPage(
              child: ApiResourceScreen(definition: ApiResources.rooms),
            ),
          ),
          GoRoute(
            path: '/appointments',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: AppointmentWorkspaceScreen()),
          ),
          GoRoute(
            path: '/schedules',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ScheduleScreen()),
          ),
          GoRoute(
            path: '/clinical',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ClinicalHubScreen()),
          ),
          GoRoute(
            path: '/pharmacy',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: PharmacyScreen()),
          ),
          GoRoute(
            path: '/laboratory',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: LaboratoryScreen()),
          ),
          GoRoute(
            path: '/billing',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: BillingScreen()),
          ),
          GoRoute(
            path: '/ai',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: AiAssistantScreen()),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ProfileScreen()),
          ),
          GoRoute(
            path: '/api-catalog',
            pageBuilder: (context, state) =>
                const NoTransitionPage(child: ApiCatalogScreen()),
          ),
        ],
      ),
      GoRoute(
        path: '/404',
        builder: (context, state) => const NotFoundScreen(),
      ),
    ],
  );
}
