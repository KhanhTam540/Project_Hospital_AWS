'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('admin medical record page is cover-only and read-only', () => {
  const page = read('web/src/pages/admin/ManageHoSoBenhAn.jsx');

  assert.match(page, /Tủ hồ sơ bệnh án/);
  assert.match(page, /Nội dung chi tiết được bảo vệ/);
  assert.match(page, /Tài khoản Admin chỉ được xem thông tin bên ngoài/);
  assert.doesNotMatch(page, /axios\.post\(/);
  assert.doesNotMatch(page, /axios\.put\(/);
  assert.doesNotMatch(page, /axios\.delete\(/);
  assert.doesNotMatch(page, /to=\{`\/admin\/hosobenhan\//);
  assert.doesNotMatch(page, /chuanDoan|lichSuBenh|diagnosis|medicalHistory/);
});

test('admin router does not expose a medical record detail page', () => {
  const routes = read('web/src/routes/adminRoutes.jsx');

  assert.doesNotMatch(routes, /ChiTietHSBAPage/);
  assert.doesNotMatch(routes, /hosobenhan\/:maHSBA/);
});

test('backend returns one protected cover per patient to admin', () => {
  const catalog = read('services/medical/admin-catalog.js');

  assert.match(catalog, /function mapMedicalRecordCover/);
  assert.match(catalog, /function pickCanonicalMedicalRecord/);
  assert.match(catalog, /detailsProtected:\s*true/);
  assert.match(catalog, /if \(hasGroup\(actor, 'ADMIN'\)\)/);
  assert.match(catalog, /recordsByPatient/);
  assert.match(catalog, /requireGroups\(event, \['BACSI', 'NHANSU'\]\)/);
});

test('admin cannot call the aggregated patient medical timeline', () => {
  const handler = read('services/medical/handler.js');

  assert.match(
    handler,
    /requirePatientScope\(\s*event,\s*patientId,\s*\['BACSI', 'NHANSU', 'BENHNHAN'\]/,
  );
});
