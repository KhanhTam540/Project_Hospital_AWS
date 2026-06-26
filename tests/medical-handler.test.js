'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createMedicalObjectKey,
  normalizeMedicineItems,
  normalizeVitals,
  safeFileName,
} = require('../services/medical/domain');
const { parseGroupsClaim } = require('../services/shared/auth');


test('safeFileName removes traversal characters', () => {
  assert.equal(safeFileName('../../x quang?.png'), '.._.._x_quang_.png');
});

test('createMedicalObjectKey uses patient and document path', () => {
  assert.equal(
    createMedicalObjectKey('BN001', 'DOC001', 'x ray.png'),
    'patients/BN001/documents/DOC001/x_ray.png',
  );
});

test('normalizeVitals accepts values in valid medical ranges', () => {
  const vitals = normalizeVitals({
    temperature: 37.2,
    heartRate: 80,
    systolicBloodPressure: 120,
    diastolicBloodPressure: 80,
    oxygenSaturation: 98,
    weightKg: 60,
    heightCm: 168,
  });

  assert.equal(vitals.temperature, 37.2);
  assert.equal(vitals.heartRate, 80);
});

test('normalizeVitals rejects impossible temperature', () => {
  assert.throws(
    () => normalizeVitals({ temperature: 60 }),
    /temperature must be between 30 and 45/,
  );
});

test('normalizeMedicineItems normalizes a valid prescription', () => {
  const items = normalizeMedicineItems([
    {
      medicineId: 'TH001',
      medicineName: 'Paracetamol',
      quantity: 10,
      dosage: '1 viên',
      frequency: '2 lần/ngày',
      durationDays: 5,
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 10);
});

test('normalizeMedicineItems rejects zero quantity', () => {
  assert.throws(
    () =>
      normalizeMedicineItems([
        {
          medicineId: 'TH001',
          medicineName: 'Paracetamol',
          quantity: 0,
          dosage: '1 viên',
          frequency: '2 lần/ngày',
          durationDays: 5,
        },
      ]),
    /quantity must be between 1 and 10000/,
  );
});

test('parseGroupsClaim supports API Gateway claim formats', () => {
  assert.deepEqual(parseGroupsClaim('["ADMIN","BACSI"]'), [
    'ADMIN',
    'BACSI',
  ]);
  assert.deepEqual(parseGroupsClaim('NHANSU, BENHNHAN'), [
    'NHANSU',
    'BENHNHAN',
  ]);
});
