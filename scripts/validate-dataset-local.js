'use strict';

const {
  loadDatasetFiles,
  validateDataset,
} = require('./dataset-utils');

const REQUIRED_ENTITY_TYPES = Object.freeze([
  'USER',
  'DEPARTMENT',
  'ROOM',
  'EXTERNAL_CLINIC',
  'STAFF',
  'DOCTOR',
  'PATIENT',
  'SHIFT',
  'WORK_SCHEDULE',
  'APPOINTMENT',
  'MEDICAL_RECORD',
  'MEDICINE',
  'PRESCRIPTION',
  'PRESCRIPTION_ITEM',
]);

function validateReferences(items) {
  const errors = [];
  const departments = new Set(
    items
      .filter((item) => item.entityType === 'DEPARTMENT')
      .map((item) => item.departmentId),
  );
  const staff = new Set(
    items
      .filter((item) => ['STAFF', 'DOCTOR'].includes(item.entityType))
      .map((item) => item.staffId || item.doctorId),
  );
  const patients = new Set(
    items
      .filter((item) => item.entityType === 'PATIENT')
      .map((item) => item.patientId),
  );
  const shifts = new Set(
    items
      .filter((item) => item.entityType === 'SHIFT')
      .map((item) => item.shiftId),
  );
  const records = new Set(
    items
      .filter((item) => item.entityType === 'MEDICAL_RECORD')
      .map((item) => item.recordId),
  );
  const medicines = new Set(
    items
      .filter((item) => item.entityType === 'MEDICINE')
      .map((item) => item.medicineId),
  );

  for (const item of items) {
    const key = `${item.pk}|${item.sk}`;

    if (
      item.departmentId &&
      ['ROOM', 'STAFF', 'DOCTOR', 'WORK_SCHEDULE', 'APPOINTMENT'].includes(
        item.entityType,
      ) &&
      !departments.has(item.departmentId)
    ) {
      errors.push(`${key}: missing department ${item.departmentId}`);
    }

    if (item.entityType === 'WORK_SCHEDULE') {
      if (!staff.has(item.staffId)) {
        errors.push(`${key}: missing staff ${item.staffId}`);
      }
      if (!shifts.has(item.shiftId)) {
        errors.push(`${key}: missing shift ${item.shiftId}`);
      }
    }

    if (item.entityType === 'APPOINTMENT') {
      if (!patients.has(item.patientId)) {
        errors.push(`${key}: missing patient ${item.patientId}`);
      }
      if (!staff.has(item.doctorId)) {
        errors.push(`${key}: missing doctor ${item.doctorId}`);
      }
    }

    if (item.entityType === 'MEDICAL_RECORD') {
      if (!patients.has(item.patientId)) {
        errors.push(`${key}: missing patient ${item.patientId}`);
      }
      if (!staff.has(item.doctorId)) {
        errors.push(`${key}: missing doctor ${item.doctorId}`);
      }
    }

    if (
      ['PRESCRIPTION', 'PRESCRIPTION_ITEM'].includes(item.entityType) &&
      !records.has(item.recordId)
    ) {
      errors.push(`${key}: missing medical record ${item.recordId}`);
    }

    if (
      item.entityType === 'PRESCRIPTION_ITEM' &&
      !medicines.has(item.medicineId)
    ) {
      errors.push(`${key}: missing medicine ${item.medicineId}`);
    }
  }

  return errors;
}

function main() {
  const { fileNames, items } = loadDatasetFiles();
  validateDataset(items);

  const counts = {};
  for (const item of items) {
    counts[item.entityType] = (counts[item.entityType] || 0) + 1;
  }

  const errors = validateReferences(items);
  for (const entityType of REQUIRED_ENTITY_TYPES) {
    if (!counts[entityType]) errors.push(`Missing entityType ${entityType}`);
  }

  console.log(`Validated ${items.length} items from ${fileNames.length} files`);
  console.table(counts);

  if (errors.length > 0) {
    throw new Error(`Local dataset validation failed:\n- ${errors.join('\n- ')}`);
  }

  console.log('Local dataset validation completed successfully');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
