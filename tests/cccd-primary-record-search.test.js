'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('medical record selector searches only by 12-digit CCCD', () => {
  const source = read(
    'web/src/components/doctor/MedicalRecordSearchSelect.jsx',
  );

  assert.match(source, /replace\(\/\\D\/g, ""\)\.slice\(0, 12\)/);
  assert.match(source, /citizenIdQuery\.length !== 12/);
  assert.match(source, /recordCitizenId\(record\) === citizenIdQuery/);
  assert.match(source, /không tìm bằng tên hoặc mã nội bộ/i);
  assert.doesNotMatch(source, /diagnosis,/);
});

test('doctor record catalog includes patients with CCCD before first examination', () => {
  const source = read('services/medical/admin-catalog.js');

  assert.match(source, /mapMedicalRecordCover/);
  assert.match(source, /patient\.citizenId/);
  assert.match(source, /CCCD_AUTO_RECORD/);
  assert.match(source, /hasStoredRecord: Boolean\(record\)/);
  assert.match(source, /filter\(\(patient\) => \/\^\\d\{12\}\$\//);
});

test('medical workflow auto-creates a record keyed by CCCD', () => {
  const source = read('services/medical/handler.js');

  assert.match(source, /async function ensureMedicalRecordForPatient/);
  assert.match(source, /MEDICAL_RECORD_CCCD_MISMATCH/);
  assert.match(source, /recordId: citizenId/);
  assert.match(source, /dataSource: 'CCCD_AUTO_RECORD'/);
  assert.match(source, /ensureMedicalRecordForPatient\(medicalRecordId, patientId\)/);
});

test('doctor pages no longer invite searching by name or internal ids', () => {
  const files = [
    'web/src/pages/bacsi/kham/PhieuKhamPage.jsx',
    'web/src/pages/bacsi/kham/KeDonThuocPage.jsx',
    'web/src/components/doctor/ExaminationPanel.jsx',
    'web/src/components/doctor/PrescriptionPanel.jsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /Tra cứu hồ sơ bằng CCCD/);
    assert.match(source, /Nhập đúng 12 số CCCD của bệnh nhân/);
    assert.doesNotMatch(source, /mã hồ sơ hoặc họ tên/i);
  }
});
