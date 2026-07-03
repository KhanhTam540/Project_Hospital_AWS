'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TABLE_NAME = 'HospitalTestTable';

const {
  buildTransaction,
  notificationTargets,
  parseMessage,
} = require('../services/core-worker/handler');

const message = {
  eventId: 'event-001',
  eventType: 'APPOINTMENT_CREATED',
  createdAt: '2099-01-01T01:00:00.000Z',
  actor: {
    sub: 'admin-sub',
    groups: ['ADMIN'],
  },
  payload: {
    appointmentId: 'LH001',
    patientId: 'BN001',
    doctorId: 'BS001',
  },
};

test('parseMessage validates a supported SQS event', () => {
  const parsed = parseMessage({ body: JSON.stringify(message) });
  assert.equal(parsed.eventType, 'APPOINTMENT_CREATED');
});

test('notificationTargets includes patient and doctor partitions', () => {
  assert.deepEqual(notificationTargets(message), [
    'PATIENT#BN001',
    'STAFF#BS001',
  ]);
});

test('buildTransaction contains idempotency and audit items', () => {
  const transaction = buildTransaction(message);
  assert.equal(transaction[0].Put.Item.pk, 'EVENT#event-001');
  assert.match(transaction[1].Put.Item.pk, /^AUDIT#/);
  assert.equal(transaction.length, 4);
});
