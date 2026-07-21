'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('patient booking resolves patient identity from JWT instead of localStorage', () => {
  const service = read('web/src/services/benhnhan/patientWorkflowService.js');
  const page = read('web/src/pages/benhnhan/lich/LichHenKhamPage.jsx');
  const routes = read('services/core/routes.js');

  assert.match(service, /axios\.get\("\/auth\/me"\)/);
  assert.match(page, /getCurrentPatientProfile/);
  assert.doesNotMatch(page, /localStorage\.getItem\("maBN"\)/);
  assert.match(routes, /body\.maBN = profile\.appUser\.patientId/);
});

test('patient can update their own profile and CCCD is validated', () => {
  const adminCatalog = read('services/medical/admin-catalog.js');
  const page = read('web/src/pages/benhnhan/taikhoan/ThongTinCaNhanPage.jsx');

  assert.match(adminCatalog, /requirePatientSelfOrAdmin/);
  assert.match(adminCatalog, /CCCD phải gồm đúng 12 chữ số/);
  assert.match(adminCatalog, /CITIZEN_ID_IMMUTABLE/);
  assert.match(page, /updateCurrentPatientProfile/);
  assert.match(page, /name="cccd"/);
});

test('patient profile synchronization preserves medical fields', () => {
  const routes = read('services/core/routes.js');
  assert.match(routes, /\.\.\.\(patient \|\| \{\}\)/);
  assert.match(routes, /citizenId: patient\?\.citizenId \|\| null/);
  assert.match(routes, /healthInsurance: patient\?\.healthInsurance \|\| null/);
});

test('new medical record uses CCCD as record id', () => {
  const adminCatalog = read('services/medical/admin-catalog.js');
  assert.match(adminCatalog, /const recordId = citizenId/);
  assert.match(adminCatalog, /MEDICAL_RECORD_ID_MUST_MATCH_CCCD/);
  assert.match(adminCatalog, /recordCode: citizenId/);
});

test('doctor pages use searchable medical-record selector', () => {
  const examPage = read('web/src/pages/bacsi/kham/PhieuKhamPage.jsx');
  const prescriptionPage = read('web/src/pages/bacsi/kham/KeDonThuocPage.jsx');
  const selector = read('web/src/components/doctor/MedicalRecordSearchSelect.jsx');

  assert.match(examPage, /MedicalRecordSearchSelect/);
  assert.match(prescriptionPage, /MedicalRecordSearchSelect/);
  assert.match(selector, /Nhập CCCD, mã hồ sơ/);
  assert.match(selector, /recordPatientName/);
  assert.match(selector, /slice\(0, 12\)/);
});

test('reception creates medical record with patient CCCD', () => {
  const page = read('web/src/pages/nhansu/tiepnhan/TiepNhanHoSoPage.jsx');
  assert.match(page, /maHSBA: selectedPatient\.cccd/);
  assert.match(page, /Mã HSBA sẽ tạo/);
});
