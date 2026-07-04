'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const { handlers } = require('../services/core/handler');
const { routeHandlers } = require('../services/medical/handler');

test('all web admin Core CRUD routes are registered', () => {
  const routes = [
    'GET /api/tai-khoan',
    'POST /api/tai-khoan',
    'GET /api/tai-khoan/{username}',
    'PUT /api/tai-khoan/{username}',
    'DELETE /api/tai-khoan/{username}',
    'POST /api/tai-khoan/{username}/enable',
    'GET /api/khoa',
    'POST /api/khoa',
    'PUT /api/khoa/{departmentId}',
    'DELETE /api/khoa/{departmentId}',
    'GET /api/phongkhamngoai',
    'POST /api/phongkhamngoai',
    'PUT /api/phongkhamngoai/{clinicId}',
    'DELETE /api/phongkhamngoai/{clinicId}',
    'GET /api/bacsi',
    'POST /api/bacsi',
    'PUT /api/bacsi/{doctorId}',
    'DELETE /api/bacsi/{doctorId}',
    'GET /api/nhansu',
    'POST /api/nhansu',
    'PUT /api/nhansu/{staffId}',
    'DELETE /api/nhansu/{staffId}',
    'GET /api/catruc',
    'POST /api/catruc',
    'PUT /api/catruc/{shiftId}',
    'DELETE /api/catruc/{shiftId}',
    'GET /api/lichkham',
    'POST /api/lichkham',
    'PUT /api/lichkham/{appointmentId}',
    'DELETE /api/lichkham/{appointmentId}',
  ];

  for (const route of routes) {
    assert.equal(typeof handlers[route], 'function', `Missing Core route ${route}`);
  }
});

test('all web admin Medical CRUD routes are registered', () => {
  const routes = [
    'GET /api/benhnhan',
    'POST /api/benhnhan',
    'PUT /api/benhnhan/{patientId}',
    'DELETE /api/benhnhan/{patientId}',
    'GET /api/hsba',
    'POST /api/hsba',
    'PUT /api/hsba/{recordId}',
    'DELETE /api/hsba/{recordId}',
    'GET /api/loaixetnghiem',
    'POST /api/loaixetnghiem',
    'PUT /api/loaixetnghiem/{typeId}',
    'DELETE /api/loaixetnghiem/{typeId}',
    'GET /api/xetnghiem',
    'POST /api/xetnghiem',
    'PUT /api/xetnghiem/{testId}',
    'DELETE /api/xetnghiem/{testId}',
    'GET /api/phanhoi',
    'PUT /api/phanhoi/{feedbackId}',
    'DELETE /api/phanhoi/{feedbackId}',
    'GET /api/tintuc',
    'POST /api/tintuc',
    'PUT /api/tintuc/{newsId}',
    'DELETE /api/tintuc/{newsId}',
    'GET /api/thuoc',
    'POST /api/thuoc',
    'PUT /api/thuoc/{medicineId}',
    'DELETE /api/thuoc/{medicineId}',
    'GET /api/thuoc/nhomthuoc',
    'POST /api/thuoc/nhomthuoc',
    'PUT /api/thuoc/nhomthuoc/{groupId}',
    'DELETE /api/thuoc/nhomthuoc/{groupId}',
    'GET /api/thuoc/donvitinh',
    'POST /api/thuoc/donvitinh',
    'PUT /api/thuoc/donvitinh/{unitId}',
    'DELETE /api/thuoc/donvitinh/{unitId}',
  ];

  for (const route of routes) {
    assert.equal(typeof routeHandlers[route], 'function', `Missing Medical route ${route}`);
  }
});

test('admin-created Cognito users are confirmed without OTP', () => {
  const source = read('services/core/cognito-service.js');
  assert.match(source, /MessageAction:\s*'SUPPRESS'/);
  assert.match(source, /AdminSetUserPasswordCommand/);
  assert.match(source, /Permanent:\s*true/);
  assert.match(source, /email_verified:\s*'true'/);
});

test('admin web removes approval, Cognito-link and doctor-assistant pages', () => {
  const menu = read('web/src/config/adminMenu.js');
  const routes = read('web/src/routes/adminRoutes.jsx');
  const dashboard = read('web/src/pages/AdminHome.jsx');

  for (const source of [menu, routes]) {
    assert.doesNotMatch(source, /duyet-dang-ky|AccountApprovalPage/i);
    assert.doesNotMatch(source, /TroLyBacSi|troly|Trợ lý bác sĩ/i);
    assert.doesNotMatch(source, /CognitoLinkPage|lien-ket-cognito/i);
  }

  assert.doesNotMatch(dashboard, /Hạ tầng AWS|SYSTEM_SERVICES|Trạng thái dịch vụ/i);
  assert.equal(
    fs.existsSync(path.join(root, 'web/src/pages/admin/nhansu/TroLyBacSiPage.jsx')),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, 'web/src/pages/admin/CognitoLinkPage.jsx')),
    false,
  );
});
