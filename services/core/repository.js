'use strict';

const {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { ApiError } = require('../shared/http');
const { documentClient, getTableName } = require('../shared/dynamodb');
const { normalizeEmail } = require('./domain');

async function scanAll(params = {}) {
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: getTableName(),
        ...params,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function queryAll(params = {}) {
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new QueryCommand({
        TableName: getTableName(),
        ...params,
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

async function getItem(pk, sk) {
  const response = await documentClient.send(
    new GetCommand({
      TableName: getTableName(),
      Key: { pk, sk },
      ConsistentRead: true,
    }),
  );

  return response.Item || null;
}

async function putItem(item, options = {}) {
  await documentClient.send(
    new PutCommand({
      TableName: getTableName(),
      Item: item,
      ...(options.createOnly
        ? {
            ConditionExpression:
              'attribute_not_exists(pk) AND attribute_not_exists(sk)',
          }
        : {}),
    }),
  );

  return item;
}

async function deleteItem(pk, sk) {
  await documentClient.send(
    new DeleteCommand({
      TableName: getTableName(),
      Key: { pk, sk },
    }),
  );
}

async function transactWrite(transactItems) {
  if (!Array.isArray(transactItems) || transactItems.length === 0) return;

  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: transactItems,
    }),
  );
}

async function listByEntityTypes(entityTypes) {
  const allowed = new Set(entityTypes);
  const items = await scanAll({
    FilterExpression: 'attribute_exists(#entityType)',
    ExpressionAttributeNames: {
      '#entityType': 'entityType',
    },
  });

  return items.filter((item) => allowed.has(item.entityType));
}

async function findOneByField(entityTypes, fieldName, value) {
  const normalizedTypes = Array.isArray(entityTypes)
    ? entityTypes
    : [entityTypes];
  const items = await listByEntityTypes(normalizedTypes);
  return (
    items.find((item) => String(item[fieldName] || '') === String(value)) ||
    null
  );
}

async function findApplicationUser(identity = {}) {
  const users = await listByEntityTypes(['USER']);
  const email = normalizeEmail(identity.email);
  const subject = String(identity.sub || '').trim();
  const username = String(identity.username || '').trim();

  return (
    users.find(
      (item) => subject && (item.cognitoSub === subject || item.userId === subject),
    ) ||
    users.find(
      (item) => username && item.cognitoUsername === username,
    ) ||
    users.find(
      (item) => email && normalizeEmail(item.email) === email,
    ) ||
    null
  );
}

async function getDepartment(departmentId) {
  return getItem(`DEPARTMENT#${departmentId}`, 'META');
}

async function listDepartments() {
  return listByEntityTypes(['DEPARTMENT']);
}

async function findRoom(roomId) {
  return findOneByField('ROOM', 'roomId', roomId);
}

async function listRooms() {
  return listByEntityTypes(['ROOM']);
}

async function findExternalClinic(clinicId) {
  return getItem(`EXTERNAL_CLINIC#${clinicId}`, 'META');
}

async function listExternalClinics() {
  return listByEntityTypes(['EXTERNAL_CLINIC']);
}

async function findDoctor(doctorId) {
  return (
    (await getItem(`STAFF#${doctorId}`, 'PROFILE')) ||
    (await findOneByField('DOCTOR', 'doctorId', doctorId))
  );
}

async function listDoctors() {
  return listByEntityTypes(['DOCTOR']);
}

async function findStaff(staffId) {
  const item = await getItem(`STAFF#${staffId}`, 'PROFILE');
  if (item?.entityType === 'STAFF') return item;
  return findOneByField('STAFF', 'staffId', staffId);
}

async function listStaff() {
  return listByEntityTypes(['STAFF']);
}

async function findPatient(patientId) {
  return getItem(`PATIENT#${patientId}`, 'PROFILE');
}

async function listPatients() {
  return listByEntityTypes(['PATIENT']);
}

async function findShift(shiftId) {
  return getItem(`SHIFT#${shiftId}`, 'META');
}

async function listShifts() {
  return listByEntityTypes(['SHIFT']);
}

async function findSchedule(scheduleId) {
  return findOneByField('WORK_SCHEDULE', 'scheduleId', scheduleId);
}

async function listSchedules() {
  return listByEntityTypes(['WORK_SCHEDULE']);
}

async function listSchedulesByStaff(staffId) {
  const indexItems = await queryAll({
    IndexName: 'gsi1',
    KeyConditionExpression:
      '#gsi1pk = :pk AND begins_with(#gsi1sk, :prefix)',
    ExpressionAttributeNames: {
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk',
    },
    ExpressionAttributeValues: {
      ':pk': `STAFF#${staffId}`,
      ':prefix': 'SCHEDULE#',
    },
  }).catch((error) => {
    if (error?.name === 'ValidationException') return [];
    throw error;
  });

  const legacyItems = (await listSchedules()).filter(
    (item) => item.staffId === staffId || item.doctorId === staffId,
  );

  const byId = new Map();
  for (const item of [...legacyItems, ...indexItems]) {
    byId.set(item.scheduleId || `${item.pk}|${item.sk}`, item);
  }
  return [...byId.values()];
}

async function findAppointment(appointmentId) {
  return (
    (await getItem(`APPOINTMENT#${appointmentId}`, 'META')) ||
    (await findOneByField(
      ['APPOINTMENT', 'APPOINTMENT_REF'],
      'appointmentId',
      appointmentId,
    ))
  );
}

function deduplicateAppointments(items) {
  const byId = new Map();

  for (const item of items) {
    const id = item.appointmentId;
    if (!id) continue;
    const current = byId.get(id);
    if (!current || item.entityType === 'APPOINTMENT') {
      byId.set(id, item);
    }
  }

  return [...byId.values()];
}

async function listAppointments() {
  return deduplicateAppointments(
    await listByEntityTypes(['APPOINTMENT', 'APPOINTMENT_REF']),
  );
}

async function listAppointmentsByPatient(patientId) {
  const partitionItems = await queryAll({
    KeyConditionExpression:
      '#pk = :pk AND begins_with(#sk, :prefix)',
    ExpressionAttributeNames: {
      '#pk': 'pk',
      '#sk': 'sk',
    },
    ExpressionAttributeValues: {
      ':pk': `PATIENT#${patientId}`,
      ':prefix': 'APPOINTMENT#',
    },
  });

  const canonicalItems = (await listAppointments()).filter(
    (item) => item.patientId === patientId,
  );

  return deduplicateAppointments([...partitionItems, ...canonicalItems]);
}

async function listAppointmentsByDoctor(doctorId) {
  const indexItems = await queryAll({
    IndexName: 'gsi1',
    KeyConditionExpression:
      '#gsi1pk = :pk AND begins_with(#gsi1sk, :prefix)',
    ExpressionAttributeNames: {
      '#gsi1pk': 'gsi1pk',
      '#gsi1sk': 'gsi1sk',
    },
    ExpressionAttributeValues: {
      ':pk': `DOCTOR#${doctorId}`,
      ':prefix': 'APPOINTMENT#',
    },
  }).catch((error) => {
    if (error?.name === 'ValidationException') return [];
    throw error;
  });

  const allItems = (await listAppointments()).filter(
    (item) => item.doctorId === doctorId,
  );

  return deduplicateAppointments([...allItems, ...indexItems]);
}

async function assertExists(itemPromise, code, message) {
  const item = await itemPromise;
  if (!item) throw new ApiError(404, code, message);
  return item;
}

module.exports = {
  assertExists,
  deleteItem,
  findApplicationUser,
  findAppointment,
  findDoctor,
  findExternalClinic,
  findOneByField,
  findPatient,
  findRoom,
  findSchedule,
  findShift,
  findStaff,
  getDepartment,
  getItem,
  listAppointments,
  listAppointmentsByDoctor,
  listAppointmentsByPatient,
  listByEntityTypes,
  listDepartments,
  listDoctors,
  listExternalClinics,
  listPatients,
  listRooms,
  listSchedules,
  listSchedulesByStaff,
  listShifts,
  listStaff,
  putItem,
  queryAll,
  scanAll,
  transactWrite,
};
