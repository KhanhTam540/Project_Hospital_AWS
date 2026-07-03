'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { SAMPLE_SOURCE, itemKey } = require('./dataset-utils');

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  console.error('Missing TABLE_NAME environment variable');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function scanSampleItems() {
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: '#dataSource = :sample',
        ExpressionAttributeNames: { '#dataSource': 'dataSource' },
        ExpressionAttributeValues: { ':sample': SAMPLE_SOURCE },
      }),
    );

    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function verifyReferences(items) {
  const errors = [];
  const byKey = new Map(items.map((item) => [itemKey(item), item]));
  const departments = new Set(items.filter((i) => i.entityType === 'DEPARTMENT').map((i) => i.departmentId));
  const staff = new Set(items.filter((i) => ['STAFF', 'DOCTOR'].includes(i.entityType)).map((i) => i.staffId || i.doctorId));
  const patients = new Set(items.filter((i) => i.entityType === 'PATIENT').map((i) => i.patientId));
  const records = new Set(items.filter((i) => i.entityType === 'MEDICAL_RECORD').map((i) => i.recordId));
  const medicines = new Set(items.filter((i) => i.entityType === 'MEDICINE').map((i) => i.medicineId));
  const labTestTypes = new Set(items.filter((i) => i.entityType === 'LAB_TEST_TYPE').map((i) => i.testTypeId));

  for (const item of items) {
    if (!item.pk || !item.sk || !item.entityType) {
      errors.push(`Invalid item ${JSON.stringify({ pk: item.pk, sk: item.sk })}`);
    }

    if (item.departmentId && !departments.has(item.departmentId)) {
      errors.push(`${itemKey(item)} references missing department ${item.departmentId}`);
    }

    if (item.entityType === 'WORK_SCHEDULE' && !staff.has(item.staffId)) {
      errors.push(`${itemKey(item)} references missing staff ${item.staffId}`);
    }

    if (item.entityType === 'APPOINTMENT') {
      if (!patients.has(item.patientId)) errors.push(`${itemKey(item)} references missing patient ${item.patientId}`);
      if (!staff.has(item.doctorId)) errors.push(`${itemKey(item)} references missing doctor ${item.doctorId}`);
    }

    if (item.entityType === 'MEDICAL_RECORD') {
      if (!patients.has(item.patientId)) errors.push(`${itemKey(item)} references missing patient ${item.patientId}`);
      if (!staff.has(item.doctorId)) errors.push(`${itemKey(item)} references missing doctor ${item.doctorId}`);
    }

    if (['PRESCRIPTION', 'PRESCRIPTION_ITEM'].includes(item.entityType) && !records.has(item.recordId)) {
      errors.push(`${itemKey(item)} references missing medical record ${item.recordId}`);
    }

    if (item.entityType === 'PRESCRIPTION_ITEM' && !medicines.has(item.medicineId)) {
      errors.push(`${itemKey(item)} references missing medicine ${item.medicineId}`);
    }

    if (item.entityType === 'LAB_TEST' && !labTestTypes.has(item.testTypeId)) {
      errors.push(`${itemKey(item)} references missing lab test type ${item.testTypeId}`);
    }

    if (item.entityType === 'FEEDBACK' && !patients.has(item.patientId)) {
      errors.push(`${itemKey(item)} references missing patient ${item.patientId}`);
    }
  }

  if (byKey.size !== items.length) errors.push('Duplicate pk/sk combinations were detected');
  return errors;
}

async function main() {
  const items = await scanSampleItems();
  if (items.length === 0) throw new Error('No sample items found. Run npm run seed:data first.');

  const counts = {};
  for (const item of items) counts[item.entityType] = (counts[item.entityType] || 0) + 1;

  const requiredTypes = [
    'USER',
    'DEPARTMENT',
    'ROOM',
    'STAFF',
    'DOCTOR',
    'PATIENT',
    'WORK_SCHEDULE',
    'APPOINTMENT',
    'MEDICAL_RECORD',
    'MEDICINE',
    'PRESCRIPTION',
    'PRESCRIPTION_ITEM',
    'LAB_TEST_TYPE',
    'LAB_TEST',
    'NEWS',
    'FEEDBACK',
  ];

  const errors = verifyReferences(items);
  for (const entityType of requiredTypes) {
    if (!counts[entityType]) errors.push(`Missing entityType ${entityType}`);
  }

  console.table(counts);
  if (errors.length > 0) throw new Error(`Verification failed:\n- ${errors.join('\n- ')}`);
  console.log(`All ${items.length} sample items are valid`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
