'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canonicalize,
  createAuditEvent,
  hashResource,
  isMedicalRecordEntity,
} = require('../services/medical-audit/domain');

test('canonicalize sorts object keys and excludes infrastructure fields', () => {
  const left = canonicalize({ b: 2, pk: 'X', a: { d: 4, c: 3 } });
  const right = canonicalize({ a: { c: 3, d: 4 }, b: 2, sk: 'META' });
  assert.equal(left, right);
});

test('hashResource changes when protected medical data changes', () => {
  const original = hashResource({
    entityType: 'LAB_RESULT',
    medicalRecordId: 'HS001',
    resultText: 'Normal',
  });
  const modified = hashResource({
    entityType: 'LAB_RESULT',
    medicalRecordId: 'HS001',
    resultText: 'Abnormal',
  });
  assert.notEqual(original, modified);
});

test('only direct medical-record entities are eligible', () => {
  assert.equal(
    isMedicalRecordEntity({
      entityType: 'PRESCRIPTION',
      sk: 'METADATA',
      recordId: 'HS001',
    }),
    true,
  );
  assert.equal(
    isMedicalRecordEntity({
      entityType: 'PRESCRIPTION',
      sk: 'PRESCRIPTION#TIME#DT001',
    }),
    false,
  );
});

test('creates a deterministic audit event for a medical record component', () => {
  const item = {
    pk: 'LAB_RESULT#PXN001',
    sk: 'METADATA',
    entityType: 'LAB_RESULT',
    labResultId: 'PXN001',
    medicalRecordId: 'HS001',
    status: 'APPROVED',
    resultText: 'Negative',
    version: 2,
  };
  const event = createAuditEvent({
    eventName: 'MODIFY',
    item,
    occurredAt: '2026-07-02T00:00:00.000Z',
  });
  assert.equal(event.medicalRecordId, 'HS001');
  assert.equal(event.resourceType, 'LAB_RESULT');
  assert.equal(event.resourceId, 'PXN001');
  assert.equal(event.action, 'LAB_RESULT_APPROVED');
  assert.equal(event.resourceVersion, 2);
  assert.match(event.payloadHash, /^[a-f0-9]{64}$/);
});
