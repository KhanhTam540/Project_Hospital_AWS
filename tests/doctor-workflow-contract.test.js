'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('doctor can manage only their own work schedule', () => {
  const source = read('services/core/routes.js');
  assert.match(
    source,
    /requireGroups\(event, \['ADMIN', 'NHANSU', 'BACSI'\]\)/,
  );
  assert.match(source, /maBS: await resolveCurrentDoctorId\(event\)/);
  assert.match(source, /await requireDoctorOwnership\(event, payload\.staffId\)/);
  assert.match(
    source,
    /await requireDoctorOwnership\(event, existing\.doctorId \|\| existing\.staffId\)/,
  );
});

test('medical API accepts both direct and legacy medical-record storage shapes', () => {
  const handler = read('services/medical/handler.js');
  const catalog = read('services/medical/admin-catalog.js');

  assert.match(handler, /async function ensureDirectEntity/);
  assert.match(handler, /entityType: 'MEDICAL_RECORD'/);
  assert.match(handler, /scanEntityTypes\(\[fallback\.entityType\]\)/);
  assert.match(catalog, /scanEntityTypes\(\['MEDICAL_RECORD', 'RECORD'\]\)/);
});

test('doctor examination page is record-centric and uses JSON medical API', () => {
  const page = read('web/src/pages/bacsi/kham/PhieuKhamPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /getHoSoBenhAnChoBacSi/);
  assert.match(page, /getPhieuKhamTheoHoSo/);
  assert.match(service, /\/patients\/\$\{encodeURIComponent\(patientId\)\}\/examinations/);
  assert.match(service, /medicalRecordId: normalizedRecord\.recordId/);
  assert.doesNotMatch(page, /multipart\/form-data/);
});

test('doctor prescription page loads and writes prescriptions by medical record', () => {
  const page = read('web/src/pages/bacsi/kham/KeDonThuocPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /getDonThuocTheoHoSo/);
  assert.match(page, /selectedExaminationId/);
  assert.match(page, /frequency/);
  assert.match(page, /durationDays/);
  assert.match(service, /\/patients\/\$\{encodeURIComponent\(normalizedRecord\.patientId\)\}\/prescriptions/);
});

test('doctor lab-request page selects a record and laboratory test', () => {
  const page = read('web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /selectedRecordId/);
  assert.match(page, /getDanhMucXetNghiem/);
  assert.match(page, /createYeuCauTheoHoSo/);
  assert.match(service, /maHSBA: normalizedRecord\.recordId/);
  assert.match(service, /maXN: normalizedLabTestId/);
});

test('doctor profile is read-only', () => {
  const page = read('web/src/pages/bacsi/ThongTinCaNhanPage.jsx');
  assert.match(page, /Thông tin chỉ đọc/);
  assert.doesNotMatch(page, /axios\.put/);
  assert.doesNotMatch(page, /handleSave/);
  assert.doesNotMatch(page, /isEditing/);
  assert.doesNotMatch(page, />\s*Chỉnh sửa\s*</);
});
