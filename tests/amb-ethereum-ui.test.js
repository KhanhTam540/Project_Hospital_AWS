'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('medical audit handler stores AMB transaction metadata on ledger blocks', () => {
  const handler = read('services/medical-audit/handler.js');
  assert.match(handler, /normalizeBlockchainConfig/);
  assert.match(handler, /appendBillingToken/);
  assert.match(handler, /Amazon Managed Blockchain Access Ethereum/);
  assert.match(handler, /blockchainTransactionUrl/);
  assert.match(handler, /updateLedgerBlockAnchor/);
  assert.match(handler, /ambConfirmedCount/);
});

test('patient medical record UI explains blockchain in non-technical language', () => {
  const page = read('web/src/pages/benhnhan/hoso/HoSoBenhAnPage.jsx');
  assert.match(page, /Bằng chứng toàn vẹn hồ sơ/);
  assert.match(page, /Dữ liệu bệnh án thật vẫn lưu trong hệ thống bệnh viện/);
  assert.match(page, /Xem biên nhận/);
  assert.match(page, /AMB\/Ethereum/);
  assert.match(page, /Kiểm tra bằng chứng/);
});

test('AMB setup scripts are available', () => {
  const configure = read('scripts/configure-amb-ethereum-secret.js');
  const testConnection = read('scripts/test-amb-ethereum-connection.js');
  assert.match(configure, /BLOCKCHAIN_MODE: 'AMB_ETHEREUM'/);
  assert.match(configure, /AMB_ETHEREUM_BILLING_TOKEN/);
  assert.match(testConnection, /getBlockNumber/);
  assert.match(testConnection, /sending real transactions requires gas/);
});
