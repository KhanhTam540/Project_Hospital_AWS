'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

test('patient medical record uses one aggregated timeline endpoint', () => {
  const handler = read('services/medical/handler.js');
  const stack = read('lib/hospital-stack.js');
  const service = read('web/src/services/hoso_BN/hsbaService.js');
  const page = read('web/src/pages/benhnhan/hoso/HoSoBenhAnPage.jsx');

  assert.match(
    handler,
    /GET \/api\/hsba\/benhnhan\/\{patientId\}\/tong-hop/,
  );
  assert.match(handler, /async function getPatientMedicalTimeline\(event\)/);
  assert.match(stack, /\/api\/hsba\/benhnhan\/\{patientId\}\/tong-hop/);
  assert.match(service, /getHoSoTongHop/);
  assert.match(page, /Đợt khám bệnh: Tháng/);
  assert.match(page, /Hồ sơ bệnh án duy nhất/);
  assert.doesNotMatch(page, /Blockchain/);
});

test('admin creation prevents a second medical record for one patient', () => {
  const catalog = read('services/medical/admin-catalog.js');
  assert.match(catalog, /MEDICAL_RECORD_ALREADY_EXISTS/);
  assert.match(catalog, /Mỗi bệnh nhân chỉ được có một hồ sơ bệnh án/);
});
