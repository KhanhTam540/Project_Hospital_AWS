'use strict';

const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');
const { DATA_SOURCE, dateOnly } = require('./dataset-v2-builder');

async function stackOutputs(region, stackName) {
  const client = new CloudFormationClient({ region });
  const response = await client.send(new DescribeStacksCommand({ StackName: stackName }));
  const stack = response.Stacks?.[0];
  if (!stack) throw new Error(`Stack ${stackName} not found`);
  return Object.fromEntries((stack.Outputs || []).map((item) => [item.OutputKey, item.OutputValue]));
}

async function scanAll(ddb, tableName) {
  const items = [];
  let exclusiveStartKey;
  do {
    const response = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }));
    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

function key(item) {
  return `${item.pk}|${item.sk}`;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
  const stackName = process.env.STACK_NAME || 'HospitalDevStack';
  const outputs = await stackOutputs(region, stackName);
  const tableName = process.env.TABLE_NAME || outputs.TableName;
  if (!tableName) throw new Error('Missing TableName output');

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  const all = await scanAll(ddb, tableName);
  const items = all.filter((item) => item.dataSource === DATA_SOURCE);
  if (!items.length) throw new Error(`No ${DATA_SOURCE} items found`);

  const errors = [];
  const byKey = new Map();
  const byType = new Map();
  for (const item of items) {
    const itemKey = key(item);
    assert(!byKey.has(itemKey), `Duplicate key ${itemKey}`, errors);
    byKey.set(itemKey, item);
    if (!byType.has(item.entityType)) byType.set(item.entityType, []);
    byType.get(item.entityType).push(item);
  }

  const requiredTypes = [
    'USER', 'DEPARTMENT', 'ROOM', 'SHIFT', 'DOCTOR', 'STAFF', 'PATIENT',
    'UNIQUE_CCCD', 'RECORD', 'WORK_SCHEDULE', 'APPOINTMENT',
    'APPOINTMENT_REF', 'APPOINTMENT_SLOT', 'EXAMINATION', 'PRESCRIPTION',
    'MEDICINE_GROUP', 'MEDICINE_UNIT', 'MEDICINE', 'LAB_TEST_TYPE',
    'LAB_TEST', 'LAB_REQUEST', 'LAB_RESULT', 'INVOICE', 'PAYMENT', 'NEWS',
    'FEEDBACK', 'EXTERNAL_CLINIC',
  ];
  for (const type of requiredTypes) {
    assert((byType.get(type) || []).length > 0, `Missing entityType ${type}`, errors);
  }

  const users = byType.get('USER') || [];
  const doctors = byType.get('DOCTOR') || [];
  const staff = byType.get('STAFF') || [];
  const patients = byType.get('PATIENT') || [];
  const records = byType.get('RECORD') || [];
  const exams = byType.get('EXAMINATION') || [];
  const prescriptions = byType.get('PRESCRIPTION') || [];
  const medicines = new Set((byType.get('MEDICINE') || []).map((item) => item.medicineId));
  const tests = new Set((byType.get('LAB_TEST') || []).map((item) => item.testId));
  const departments = new Set((byType.get('DEPARTMENT') || []).map((item) => item.departmentId));
  const doctorsById = new Map(doctors.map((item) => [item.doctorId, item]));
  const patientsById = new Map(patients.map((item) => [item.patientId, item]));
  const recordsById = new Map(records.filter((item) => item.sk === 'METADATA').map((item) => [item.recordId, item]));
  const examsById = new Map(exams.filter((item) => item.sk === 'METADATA').map((item) => [item.examinationId, item]));

  const citizenIds = new Set();
  for (const patient of patients) {
    assert(/^\d{12}$/.test(String(patient.citizenId || '')), `${patient.patientId} has invalid CCCD`, errors);
    assert(!citizenIds.has(patient.citizenId), `Duplicate CCCD ${patient.citizenId}`, errors);
    citizenIds.add(patient.citizenId);
    assert(patient.recordId === patient.citizenId, `${patient.patientId} recordId must equal CCCD`, errors);
    assert(patient.medicalRecordId === patient.citizenId, `${patient.patientId} medicalRecordId must equal CCCD`, errors);
    assert(byKey.has(`RECORD#${patient.citizenId}|METADATA`), `Missing direct record for ${patient.citizenId}`, errors);
    assert(byKey.has(`UNIQUE#CCCD#${patient.citizenId}|LOCK`), `Missing CCCD lock for ${patient.citizenId}`, errors);
    const user = users.find((item) => item.patientId === patient.patientId);
    assert(Boolean(user), `Missing USER mapping for ${patient.patientId}`, errors);
    if (user) assert(user.cognitoSub === patient.cognitoSub, `Cognito sub mismatch for ${patient.patientId}`, errors);
  }

  for (const doctor of doctors) {
    assert(departments.has(doctor.departmentId), `${doctor.doctorId} references missing department`, errors);
    const user = users.find((item) => item.doctorId === doctor.doctorId);
    assert(Boolean(user), `Missing USER mapping for ${doctor.doctorId}`, errors);
    if (user) assert(user.cognitoSub === doctor.cognitoSub, `Cognito sub mismatch for ${doctor.doctorId}`, errors);
  }

  for (const employee of staff) {
    assert(departments.has(employee.departmentId), `${employee.staffId} references missing department`, errors);
    assert(['TN', 'YT', 'XN'].includes(employee.staffType), `${employee.staffId} has unsupported staffType`, errors);
  }

  const today = dateOnly(0);
  const futureSchedules = (byType.get('WORK_SCHEDULE') || []).filter((item) => item.workDate >= today && item.status === 'ACTIVE');
  assert(futureSchedules.length >= 10, 'Not enough future work schedules', errors);

  const appointments = byType.get('APPOINTMENT') || [];
  for (const appointment of appointments) {
    assert(patientsById.has(appointment.patientId), `${appointment.appointmentId} references missing patient`, errors);
    assert(doctorsById.has(appointment.doctorId), `${appointment.appointmentId} references missing doctor`, errors);
    assert(byKey.has(`PATIENT#${appointment.patientId}|APPOINTMENT#${appointment.appointmentDateTime}#${appointment.appointmentId}`), `${appointment.appointmentId} missing patient projection`, errors);
    assert(byKey.has(`STAFF#${appointment.doctorId}|APPOINTMENT#${appointment.appointmentDateTime}#${appointment.appointmentId}`), `${appointment.appointmentId} missing doctor projection`, errors);
    assert(byKey.has(`DOCTOR_SLOT#${appointment.doctorId}|${appointment.appointmentDateTime}`), `${appointment.appointmentId} missing doctor slot`, errors);
    assert(byKey.has(`PATIENT_SLOT#${appointment.patientId}|${appointment.appointmentDateTime}`), `${appointment.appointmentId} missing patient slot`, errors);
  }

  for (const exam of exams.filter((item) => item.sk === 'METADATA')) {
    assert(patientsById.has(exam.patientId), `${exam.examinationId} references missing patient`, errors);
    assert(recordsById.has(exam.recordId), `${exam.examinationId} references missing record`, errors);
  }

  for (const prescription of prescriptions.filter((item) => item.sk === 'METADATA')) {
    assert(patientsById.has(prescription.patientId), `${prescription.prescriptionId} references missing patient`, errors);
    assert(recordsById.has(prescription.recordId), `${prescription.prescriptionId} references missing record`, errors);
    assert(examsById.has(prescription.examinationId), `${prescription.prescriptionId} references missing examination`, errors);
    for (const medicineItem of prescription.medicineItems || []) {
      assert(medicines.has(medicineItem.medicineId), `${prescription.prescriptionId} references missing medicine ${medicineItem.medicineId}`, errors);
    }
  }

  for (const request of (byType.get('LAB_REQUEST') || []).filter((item) => item.sk === 'METADATA')) {
    assert(patientsById.has(request.patientId), `${request.labRequestId} references missing patient`, errors);
    assert(recordsById.has(request.medicalRecordId), `${request.labRequestId} references missing record`, errors);
    assert(tests.has(request.labTestId), `${request.labRequestId} references missing lab test`, errors);
  }

  const counts = {};
  for (const [type, typedItems] of byType.entries()) counts[type] = typedItems.length;
  console.table(counts);
  if (errors.length) {
    throw new Error(`Dataset verification failed:\n- ${errors.join('\n- ')}`);
  }
  console.log(`PASS: ${items.length} ${DATA_SOURCE} items are internally consistent.`);
  console.log(`PASS: ${patients.length} patients use unique 12-digit CCCD as medical record IDs.`);
  console.log(`PASS: ${appointments.length} canonical appointments include all projections and slot locks.`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
