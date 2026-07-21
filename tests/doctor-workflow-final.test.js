'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const doctorFrontendFiles = [
  'web/src/services/bacsi/bacsiService.js',
  'web/src/services/bacsi/doctorWorkflowService.js',
  'web/src/services/lich/lichlamviecService.js',
  'web/src/services/kham/phieukhamService.js',
  'web/src/services/donthuoc/donthuocService.js',
  'web/src/services/xetnghiem/yeucauxetnghiemService.js',
  'web/src/pages/bacsi/lich/LichLamViecPage.jsx',
  'web/src/pages/bacsi/kham/PhieuKhamPage.jsx',
  'web/src/pages/bacsi/kham/KeDonThuocPage.jsx',
  'web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx',
  'web/src/pages/bacsi/ThongTinCaNhanPage.jsx',
  'web/src/layouts/DoctorLayout.jsx',
  'web/src/pages/bacsi/hangcho/DoctorQueuePage.jsx',
  'web/src/components/doctor/ExaminationPanel.jsx',
  'web/src/components/doctor/PrescriptionPanel.jsx',
];

test('doctor identity is resolved from JWT and reused by schedule screens', () => {
  const core = read('services/core/routes.js');
  const service = read('web/src/services/bacsi/bacsiService.js');
  const schedulePage = read('web/src/pages/bacsi/lich/LichLamViecPage.jsx');

  assert.match(core, /const resolvedDoctorId = groups\.includes\('BACSI'\)/);
  assert.match(core, /maBS: await resolveCurrentDoctorId\(event\)/);
  assert.match(service, /axios\.get\("\/me"\)/);
  assert.match(service, /resolveCurrentDoctor\(\{ forceRefresh = false \} = \{\}\)/);
  assert.match(schedulePage, /resolveCurrentDoctor\(\{ forceRefresh: true \}\)/);
  assert.doesNotMatch(schedulePage, /localStorage\.getItem\("maTK"\)/);
});

test('medical-record catalog reads both legacy and direct record shapes', () => {
  const catalog = read('services/medical/admin-catalog.js');
  const workflow = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(catalog, /scanEntityTypes\(\['MEDICAL_RECORD', 'RECORD'\]\)/);
  assert.match(catalog, /uniqueByIdentifier/);
  assert.match(catalog, /medicalRecordId: recordId/);
  assert.match(workflow, /axios\.get\("\/hsba"\)/);
  assert.match(workflow, /normalizeMedicalRecord/);
});

test('examination and prescription lists are record-scoped', () => {
  const handler = read('services/medical/handler.js');
  const workflow = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(handler, /async function listExaminations\(event\)/);
  assert.match(handler, /medicalRecordId \|\| query\.recordId \|\| query\.maHSBA/);
  assert.match(handler, /async function listPrescriptions\(event\)/);
  assert.match(handler, /query\.examinationId \|\| query\.maPK/);
  assert.match(workflow, /getExaminationsByRecord/);
  assert.match(workflow, /getPrescriptionsByRecord/);
  assert.match(workflow, /examinationId: normalizedExamination\.examinationId/);
});

test('lab request workflow preserves UUID field case and sends all relations', () => {
  const backend = read('services/medical/lab-workflow.js');
  const workflow = read('web/src/services/bacsi/doctorWorkflowService.js');
  const page = read('web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx');

  assert.match(backend, /function requiredIdentifier/);
  assert.match(backend, /function sameIdentifier/);
  assert.match(backend, /const patientId = requiredIdentifier/);
  assert.match(backend, /const medicalRecordId = requiredIdentifier/);
  assert.match(backend, /const labTestId = requiredIdentifier/);
  assert.match(workflow, /maBN: normalizedRecord\.patientId/);
  assert.match(workflow, /maHSBA: normalizedRecord\.recordId/);
  assert.match(workflow, /maXN: normalizedLabTestId/);
  assert.match(page, /createYeuCauTheoHoSo/);
});

test('doctor profile is strictly read-only in UI and update remains admin-only', () => {
  const page = read('web/src/pages/bacsi/ThongTinCaNhanPage.jsx');
  const core = read('services/core/routes.js');

  assert.match(page, /Thông tin chỉ đọc/);
  assert.doesNotMatch(page, /handleSave/);
  assert.doesNotMatch(page, /isEditing/);
  assert.doesNotMatch(page, /axios\.put/);
  assert.doesNotMatch(page, />\s*Chỉnh sửa\s*</);
  assert.doesNotMatch(page, />\s*Lưu thay đổi\s*</);
  assert.match(core, /async function handleUpdateDoctor[\s\S]*requireGroups\(event, \['ADMIN'\]\)/);
});

test('doctor frontend no longer calls legacy examination or prescription endpoints', () => {
  const source = doctorFrontendFiles.map(read).join('\n');

  assert.doesNotMatch(source, /\/phieukham\/bacsi\//);
  assert.doesNotMatch(source, /axios\.(post|put)\(["']\/phieukham["']/);
  assert.doesNotMatch(source, /axios\.(post|put)\(["']\/donthuoc["']/);
  assert.match(source, /\/patients\/\$\{encodeURIComponent\(normalizedRecord\.patientId\)\}\/examinations/);
  assert.match(source, /\/patients\/\$\{encodeURIComponent\(normalizedRecord\.patientId\)\}\/prescriptions/);
});
