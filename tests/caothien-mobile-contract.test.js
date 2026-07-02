'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const projectRoot = path.resolve(__dirname, '..');
const mobileRoot = path.join(projectRoot, 'mobile');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('Cao Thien week 2 backend exposes appointment and lab-result routes', () => {
  const handlerSource = read('services/medical/handler.js');
  const stackSource = read('lib/hospital-stack.js');

  for (const route of [
    'POST /api/lichkham',
    'GET /api/lichkham/{appointmentId}',
    'DELETE /api/lichkham/{appointmentId}',
    'GET /api/phieuxetnghiem',
    'GET /api/phieuxetnghiem/{labResultId}',
  ]) {
    assert.match(handlerSource, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(stackSource, /\/api\/lichkham\/\{appointmentId\}/);
  assert.match(stackSource, /\/api\/phieuxetnghiem\/\{labResultId\}/);
});

test('mobile source uses runtime AWS configuration instead of localhost', () => {
  assert.ok(fs.existsSync(mobileRoot), 'mobile directory is missing');

  const apiClient = read('mobile/lib/services/api_client.dart');
  const appConfig = read('mobile/lib/config/app_config.dart');

  assert.doesNotMatch(apiClient, /10\.0\.2\.2|localhost|127\.0\.0\.1/);
  assert.match(appConfig, /API_BASE_URL/);
  assert.match(appConfig, /COGNITO_USER_POOL_ID/);
  assert.match(appConfig, /COGNITO_CLIENT_ID/);
});

test('mobile authentication uses Cognito and does not persist raw JWT', () => {
  const authService = read('mobile/lib/services/auth_service.dart');
  const authProvider = read('mobile/lib/auth/auth_provider.dart');

  assert.match(authService, /Amplify\.Auth\.signIn/);
  assert.match(authService, /Amplify\.Auth\.signUp/);
  assert.match(authService, /Amplify\.Auth\.confirmSignUp/);
  assert.match(authService, /Amplify\.Auth\.resetPassword/);
  assert.doesNotMatch(authProvider, /setString\(['"]token['"]/);
});

test('mobile week 2 screens use the protected AWS API routes', () => {
  const appointments = read(
    'mobile/lib/screens/patient/lich_hen_bn_screen.dart',
  );
  const records = read(
    'mobile/lib/screens/patient/ho_so_benh_an_screen.dart',
  );
  const labs = read(
    'mobile/lib/screens/patient/ket_qua_xet_nghiem_screen.dart',
  );

  assert.match(appointments, /\/lichkham/);
  assert.match(records, /\/patients\/\$patientId\/records/);
  assert.match(labs, /\/phieuxetnghiem/);
});

test('mobile router refreshes when Cognito authentication state changes', () => {
  const source = read('mobile/lib/routes/app_router.dart');
  const main = read('mobile/lib/main.dart');

  assert.match(source, /GoRouter createAppRouter\(AuthProvider auth\)/);
  assert.match(source, /refreshListenable:\s*auth/);
  assert.match(source, /path:\s*'\/404'/);
  assert.match(main, /final router = createAppRouter\(authProvider\)/);
});

test('mobile admin account screens use Core API response and Cognito username', () => {
  const model = read('mobile/lib/models/user_model.dart');
  const list = read('mobile/lib/screens/admin/user_management_screen.dart');
  const roles = read('mobile/lib/screens/admin/assign_role_screen.dart');

  assert.match(model, /final String username/);
  assert.match(list, /data\['users'\]/);
  assert.match(list, /user\.username/);
  assert.match(roles, /data\['users'\]/);
  assert.match(roles, /user\.username/);
});

test('mobile package does not ship machine-specific Android local.properties', () => {
  assert.equal(
    fs.existsSync(path.join(mobileRoot, 'android', 'local.properties')),
    false,
  );
});
