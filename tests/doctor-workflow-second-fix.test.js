'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('doctor examination page uses medical-record patient endpoint', () => {
  const page = read('web/src/pages/bacsi/kham/PhieuKhamPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /getHoSoBenhAnChoBacSi/);
  assert.match(page, /getPhieuKhamTheoHoSo/);
  assert.match(service, /\/patients\/\$\{encodeURIComponent\(patientId\)\}\/examinations/);
  assert.match(service, /medicalRecordId: normalizedRecord\.recordId/);
  assert.doesNotMatch(page, /multipart\/form-data/);
  assert.doesNotMatch(page, /\/phieukham\/bacsi/);
});

test('prescription page requires a selected examination', () => {
  const page = read('web/src/pages/bacsi/kham/KeDonThuocPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /selectedExaminationId/);
  assert.match(page, /Vui lòng chọn phiếu khám cần kê đơn/);
  assert.match(service, /examinationId: normalizedExamination\.examinationId/);
  assert.match(service, /\/prescriptions/);
  assert.doesNotMatch(page, /multipart\/form-data/);
  assert.doesNotMatch(page, /axiosClient\.post\("\/donthuoc"/);
});

test('lab request page sends record and lab test identifiers', () => {
  const page = read('web/src/pages/bacsi/xetnghiem/QuanLyYeuCauXNPage.jsx');
  const service = read('web/src/services/bacsi/doctorWorkflowService.js');

  assert.match(page, /selectedRecordId/);
  assert.match(page, /getDanhMucXetNghiem/);
  assert.match(service, /maHSBA: normalizedRecord\.recordId/);
  assert.match(service, /maXN: labTestId/);
  assert.match(service, /\/yeucauxetnghiem/);
});

test('doctor personal information page is strictly read-only', () => {
  const page = read('web/src/pages/bacsi/ThongTinCaNhanPage.jsx');

  assert.match(page, /Thông tin chỉ đọc/);
  assert.doesNotMatch(page, /isEditing/);
  assert.doesNotMatch(page, /handleSave/);
  assert.doesNotMatch(page, /axios\.put/);
  assert.doesNotMatch(page, />\s*Chỉnh sửa\s*</);
  assert.doesNotMatch(page, />\s*Lưu thay đổi\s*</);
});

test('medical backend supports legacy medical-record storage and prescription examination link', () => {
  const handler = read('services/medical/handler.js');

  assert.match(handler, /PATIENT#\{patientId\} \/ MEDICAL_RECORD#/);
  assert.match(handler, /fallback\.entityType/);
  assert.match(handler, /EXAMINATION_RECORD_MISMATCH/);
  assert.match(handler, /examinationId,/);
  assert.match(handler, /medicalRecordId: recordId/);
});
