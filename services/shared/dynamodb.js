'use strict';

let documentClient;

function getDocumentClient() {
  if (!documentClient) {
    // Lazy loading keeps key-builder unit tests independent from AWS credentials.
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }
  return documentClient;
}

function getTableName() {
  const tableName = process.env.TABLE_NAME;
  if (!tableName) throw new Error('Missing TABLE_NAME environment variable');
  return tableName;
}

function normalizeId(value, fieldName = 'id') {
  const id = String(value || '').trim().toUpperCase();
  if (!id) throw new Error(`${fieldName} is required`);
  if (!/^[A-Z0-9_-]+$/.test(id)) {
    throw new Error(`${fieldName} contains unsupported characters`);
  }
  return id;
}

function userKey(userId) {
  return { pk: `USER#${normalizeId(userId, 'userId')}`, sk: 'PROFILE' };
}

function departmentKey(departmentId) {
  return { pk: `DEPARTMENT#${normalizeId(departmentId, 'departmentId')}`, sk: 'META' };
}

function roomKey(departmentId, roomId) {
  return {
    pk: `DEPARTMENT#${normalizeId(departmentId, 'departmentId')}`,
    sk: `ROOM#${normalizeId(roomId, 'roomId')}`,
  };
}

function staffKey(staffId) {
  return { pk: `STAFF#${normalizeId(staffId, 'staffId')}`, sk: 'PROFILE' };
}

function doctorKey(doctorId) {
  return staffKey(doctorId);
}

function patientKey(patientId) {
  return { pk: `PATIENT#${normalizeId(patientId, 'patientId')}`, sk: 'PROFILE' };
}

function workScheduleKey(staffId, workDate, shiftId) {
  return {
    pk: `STAFF#${normalizeId(staffId, 'staffId')}`,
    sk: `SCHEDULE#${String(workDate).trim()}#${normalizeId(shiftId, 'shiftId')}`,
  };
}

function appointmentKey(patientId, appointmentDateTime, appointmentId) {
  return {
    pk: `PATIENT#${normalizeId(patientId, 'patientId')}`,
    sk: `APPOINTMENT#${String(appointmentDateTime).trim()}#${normalizeId(appointmentId, 'appointmentId')}`,
  };
}

function medicalRecordKey(patientId, recordId) {
  return {
    pk: `PATIENT#${normalizeId(patientId, 'patientId')}`,
    sk: `MEDICAL_RECORD#${normalizeId(recordId, 'recordId')}`,
  };
}

function prescriptionKey(recordId, prescriptionId) {
  return {
    pk: `MEDICAL_RECORD#${normalizeId(recordId, 'recordId')}`,
    sk: `PRESCRIPTION#${normalizeId(prescriptionId, 'prescriptionId')}`,
  };
}

function prescriptionItemKey(recordId, prescriptionId, medicineId) {
  return {
    pk: `MEDICAL_RECORD#${normalizeId(recordId, 'recordId')}`,
    sk: `PRESCRIPTION#${normalizeId(prescriptionId, 'prescriptionId')}#MEDICINE#${normalizeId(medicineId, 'medicineId')}`,
  };
}

function medicineKey(medicineId) {
  return { pk: `MEDICINE#${normalizeId(medicineId, 'medicineId')}`, sk: 'META' };
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  getDocumentClient,
  getTableName,
  normalizeId,
  userKey,
  departmentKey,
  roomKey,
  staffKey,
  doctorKey,
  patientKey,
  workScheduleKey,
  appointmentKey,
  medicalRecordKey,
  prescriptionKey,
  prescriptionItemKey,
  medicineKey,
  nowIso,
};
