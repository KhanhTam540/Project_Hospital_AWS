'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPatientId,
  normalizeCitizenId,
  citizenLockKey,
  buildRecordItems,
} = require('../services/auth-trigger/handler');

function read(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

test('CCCD normalization requires exactly 12 digits', () => {
  assert.equal(normalizeCitizenId('083204003906'), '083204003906');
  assert.throws(() => normalizeCitizenId('08320400390'), /12 chữ số/);
  assert.throws(() => normalizeCitizenId('08320400390A'), /12 chữ số/);
});

test('patient id remains internal while medical record id is CCCD', () => {
  const patientId = buildPatientId('c9ba254c-f011-70cb-428b-001f6a8cc012');
  const citizenId = '083204003906';
  const now = '2026-07-03T12:00:00.000Z';
  const { directRecord, patientRecord } = buildRecordItems({
    citizenId,
    patientId,
    now,
  });

  assert.match(patientId, /^BN-/);
  assert.equal(directRecord.recordId, citizenId);
  assert.equal(directRecord.medicalRecordId, citizenId);
  assert.equal(directRecord.pk, `RECORD#${citizenId}`);
  assert.equal(patientRecord.patientId, patientId);
  assert.equal(patientRecord.recordCode, citizenId);
  assert.match(patientRecord.sk, new RegExp(`^RECORD#.+#${citizenId}$`));
});

test('CCCD uniqueness lock is deterministic', () => {
  assert.deepEqual(citizenLockKey('083204003906'), {
    pk: 'UNIQUE#CCCD#083204003906',
    sk: 'LOCK',
  });
});

test('registration page sends CCCD to Cognito sign-up', () => {
  const registerPage = read('web/src/pages/RegisterPage.jsx');
  const cognitoAuth = read('web/src/auth/cognitoAuth.js');

  assert.match(registerPage, /label="CCCD"/);
  assert.match(registerPage, /CCCD_RE = \/\^\\d\{12\}\$\//);
  assert.match(registerPage, /cccd: normalizedCitizenId/);
  assert.match(cognitoAuth, /"custom:cccd": normalizedCitizenId/);
});

test('Cognito infrastructure accepts custom CCCD and invokes pre-sign-up validation', () => {
  const stack = read('lib/hospital-stack.js');

  assert.match(stack, /cccd: new cognito\.StringAttribute/);
  assert.match(stack, /withCustomAttributes\('cccd'\)/);
  assert.match(stack, /\.PRE_SIGN_UP/);
  assert.match(stack, /grantReadWriteData\([\s\S]*postConfirmationFunction/);
});

test('post-confirmation creates patient and record relations from CCCD', () => {
  const trigger = read('services/auth-trigger/handler.js');
  const coreRoutes = read('services/core/routes.js');

  assert.match(trigger, /attributes\['custom:cccd'\]/);
  assert.match(trigger, /recordId: citizenId/);
  assert.match(trigger, /medicalRecordId: citizenId/);
  assert.match(trigger, /UNIQUE#CCCD#/);
  assert.match(coreRoutes, /attributes\['custom:cccd'\]/);
});
