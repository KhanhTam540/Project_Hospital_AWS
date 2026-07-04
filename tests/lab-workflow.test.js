'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeLabStatus,
  toLegacyRequest,
  toLegacyResult,
} = require('../services/medical/lab-workflow');

test('normalizes Vietnamese laboratory statuses', () => {
  assert.equal(normalizeLabStatus('đã hoàn thành'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')), 'DA HOAN THANH');
  assert.equal(normalizeLabStatus('DA_HOAN_THANH'), 'COMPLETED');
  assert.equal(normalizeLabStatus('DA_DUYET'), 'APPROVED');
});

test('maps lab request to frontend-compatible fields', () => {
  const mapped = toLegacyRequest({
    labRequestId: 'YC001',
    patientId: 'BN001',
    medicalRecordId: 'HS001',
    labTestId: 'XN001',
    status: 'REQUESTED',
  });
  assert.equal(mapped.maYeuCau, 'YC001');
  assert.equal(mapped.maBN, 'BN001');
  assert.equal(mapped.maHSBA, 'HS001');
});

test('maps lab result to frontend-compatible fields', () => {
  const mapped = toLegacyResult({
    labResultId: 'PXN001',
    labRequestId: 'YC001',
    patientId: 'BN001',
    medicalRecordId: 'HS001',
    resultText: 'Negative',
    status: 'APPROVED',
  });
  assert.equal(mapped.maPhieuXN, 'PXN001');
  assert.equal(mapped.ketQua, 'Negative');
  assert.equal(mapped.trangThai, 'APPROVED');
});
