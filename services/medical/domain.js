'use strict';

const {
  numberInRange,
  optionalString,
  requiredArray,
  requiredString,
} = require('../shared/validation');

function safeFileName(value) {
  const originalName = requiredString(value, 'fileName', { maxLength: 180 });
  const sanitized = originalName
    .replace(/[\\/]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/\s+/g, '_');

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw new Error('fileName is invalid');
  }
  return sanitized;
}

function createMedicalObjectKey(patientId, documentId, fileName) {
  return `patients/${patientId}/documents/${documentId}/${safeFileName(
    fileName,
  )}`;
}

function normalizeVitals(input = {}) {
  return {
    temperature: numberInRange(input.temperature, 'temperature', {
      min: 30,
      max: 45,
    }),
    heartRate: numberInRange(input.heartRate, 'heartRate', {
      min: 20,
      max: 250,
      integer: true,
    }),
    systolicBloodPressure: numberInRange(
      input.systolicBloodPressure,
      'systolicBloodPressure',
      { min: 50, max: 300, integer: true },
    ),
    diastolicBloodPressure: numberInRange(
      input.diastolicBloodPressure,
      'diastolicBloodPressure',
      { min: 30, max: 200, integer: true },
    ),
    oxygenSaturation: numberInRange(
      input.oxygenSaturation,
      'oxygenSaturation',
      { min: 50, max: 100 },
    ),
    weightKg: numberInRange(input.weightKg, 'weightKg', {
      min: 1,
      max: 500,
    }),
    heightCm: numberInRange(input.heightCm, 'heightCm', {
      min: 30,
      max: 250,
    }),
  };
}

function normalizeMedicineItems(items) {
  return requiredArray(items, 'medicineItems', {
    minLength: 1,
    maxLength: 50,
  }).map((item, index) => ({
    medicineId: requiredString(
      item?.medicineId,
      `medicineItems[${index}].medicineId`,
      { maxLength: 100 },
    ),
    medicineName: requiredString(
      item?.medicineName,
      `medicineItems[${index}].medicineName`,
      { maxLength: 200 },
    ),
    quantity: numberInRange(
      item?.quantity,
      `medicineItems[${index}].quantity`,
      { min: 1, max: 10000, integer: true, required: true },
    ),
    dosage: requiredString(
      item?.dosage,
      `medicineItems[${index}].dosage`,
      { maxLength: 200 },
    ),
    frequency: requiredString(
      item?.frequency,
      `medicineItems[${index}].frequency`,
      { maxLength: 100 },
    ),
    durationDays: numberInRange(
      item?.durationDays,
      `medicineItems[${index}].durationDays`,
      { min: 1, max: 365, integer: true, required: true },
    ),
    instructions: optionalString(
      item?.instructions,
      `medicineItems[${index}].instructions`,
      { maxLength: 500 },
    ),
  }));
}

module.exports = {
  createMedicalObjectKey,
  normalizeMedicineItems,
  normalizeVitals,
  safeFileName,
};
