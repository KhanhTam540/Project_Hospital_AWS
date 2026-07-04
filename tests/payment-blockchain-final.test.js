'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLedgerBlock,
  createAuditEvent,
  isMedicalRecordEntity,
  ledgerPartitionKey,
} = require('../services/medical-audit/domain');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('medical audit accepts CCCD keyed medical record and paid invoice entities', () => {
  assert.equal(
    isMedicalRecordEntity({
      entityType: 'RECORD',
      sk: 'METADATA',
      recordId: '079203000001',
    }),
    true,
  );

  assert.equal(
    isMedicalRecordEntity({
      entityType: 'INVOICE',
      sk: 'METADATA',
      invoiceId: 'HD001',
      medicalRecordId: '079203000001',
      status: 'PAID',
    }),
    true,
  );
});

test('ledger block links payload hash to previous block hash', () => {
  const event = createAuditEvent({
    eventName: 'MODIFY',
    occurredAt: '2026-07-03T12:00:00.000Z',
    item: {
      pk: 'INVOICE#HD001',
      sk: 'METADATA',
      entityType: 'INVOICE',
      invoiceId: 'HD001',
      medicalRecordId: '079203000001',
      status: 'PAID',
      totalAmount: 350000,
      version: 2,
    },
  });

  const first = buildLedgerBlock({
    auditEvent: event,
    previousHash: 'GENESIS',
    blockNumber: 1,
    createdAt: '2026-07-03T12:00:01.000Z',
  });

  assert.equal(first.pk, ledgerPartitionKey('079203000001'));
  assert.equal(first.documentType, 'INVOICE');
  assert.equal(first.previousHash, 'GENESIS');
  assert.match(first.payloadHash, /^[a-f0-9]{64}$/);
  assert.match(first.blockHash, /^[a-f0-9]{64}$/);
});

test('patient payment page supports demo payment instead of requiring VNPAY or MOMO', () => {
  const page = read('web/src/pages/benhnhan/hoadon/GioHangThanhToanPage.jsx');
  const service = read('web/src/services/hoadon_BN/hoadonService.js');
  const handler = read('services/payment-sms/handler.js');

  assert.match(page, /BANK_TRANSFER/);
  assert.match(page, /createThanhToan/);
  assert.match(page, /XÁC NHẬN THANH TOÁN DEMO/);
  assert.match(service, /createThanhToanDemo/);
  assert.match(handler, /Demo payment only supports CASH or BANK_TRANSFER/);
  assert.match(handler, /'BENHNHAN'/);
});

test('patient medical record page can verify blockchain integrity', () => {
  const page = read('web/src/pages/benhnhan/hoso/HoSoBenhAnPage.jsx');
  const service = read('web/src/services/medical/ledgerService.js');

  assert.match(page, /Medical Integrity Ledger/);
  assert.match(page, /verifyMedicalLedger/);
  assert.match(service, /medical-records/);
  assert.match(service, /integrity/);
});
