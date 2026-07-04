'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('patient timeline uses CCCD record before legacy HSBA record', () => {
  const handler = read('services/medical/handler.js');
  assert.match(handler, /'RECORD'/);
  assert.match(handler, /pickCanonicalPatientRecord/);
  assert.match(handler, /isTwelveDigitCitizenId/);
  assert.match(handler, /canonicalRecordId/);
  assert.match(handler, /maHSBAHienThi/);
});

test('patient medical record page verifies ledger by CCCD-compatible record id', () => {
  const page = read('web/src/pages/benhnhan/hoso/HoSoBenhAnPage.jsx');
  assert.match(page, /visibleRecordId/);
  assert.match(page, /ledgerRecordId/);
  assert.match(page, /loadLedgerStatus\(integrityRecordId\)/);
  assert.doesNotMatch(page, /loadLedgerStatus\(hoSo\.maHSBA\)/);
});

test('patient payment page can create invoice from pending appointment without maHD', () => {
  const page = read('web/src/pages/benhnhan/hoadon/GioHangThanhToanPage.jsx');
  assert.match(page, /createInvoiceForAppointment/);
  assert.match(page, /APPOINTMENT_\$\{appointmentId\}/);
  assert.match(page, /Tạo hóa đơn/);
  assert.match(page, /getCurrentPatientProfile/);
  assert.match(page, /Đang chờ thanh toán/);
});

test('payment backend stores appointment id and updates appointment after demo payment', () => {
  const handler = read('services/payment-sms/handler.js');
  assert.match(handler, /appointmentPaymentWrites/);
  assert.match(handler, /appointmentId: body\.appointmentId/);
  assert.match(handler, /status: 'DA_THANH_TOAN'/);
  assert.match(handler, /maHD: invoice\.invoiceId/);
});
