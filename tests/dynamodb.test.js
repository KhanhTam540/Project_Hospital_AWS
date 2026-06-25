'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  userKey,
  roomKey,
  patientKey,
  appointmentKey,
  prescriptionItemKey,
} = require('../services/shared/dynamodb');

test('key builders create expected DynamoDB keys', () => {
  assert.deepEqual(userKey('user001'), { pk: 'USER#USER001', sk: 'PROFILE' });
  assert.deepEqual(roomKey('khoa_noi', 'pk_01'), { pk: 'DEPARTMENT#KHOA_NOI', sk: 'ROOM#PK_01' });
  assert.deepEqual(patientKey('bn001'), { pk: 'PATIENT#BN001', sk: 'PROFILE' });
  assert.deepEqual(appointmentKey('bn001', '2026-07-01T08:00:00+07:00', 'lh001'), {
    pk: 'PATIENT#BN001',
    sk: 'APPOINTMENT#2026-07-01T08:00:00+07:00#LH001',
  });
  assert.deepEqual(prescriptionItemKey('hs001', 'dt001', 'th001'), {
    pk: 'MEDICAL_RECORD#HS001',
    sk: 'PRESCRIPTION#DT001#MEDICINE#TH001',
  });
});
