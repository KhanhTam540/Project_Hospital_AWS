'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  readMedicalDataset,
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

const patientPk = (patientId) => `PATIENT#${patientId}`;
const directKey = (entity, id) => ({
  pk: `${entity}#${id}`,
  sk: 'METADATA',
});
const chronologicalSk = (prefix, createdAt, id) =>
  `${prefix}#${createdAt}#${id}`;

async function put(TableName, Item) {
  await ddb.send(new PutCommand({ TableName, Item }));
}

async function putProjection(TableName, entity, id, patientId, prefix, item) {
  const patientSk = chronologicalSk(prefix, item.createdAt, id);
  await put(TableName, {
    ...item,
    ...directKey(entity, id),
    patientSk,
  });
  await put(TableName, {
    ...item,
    pk: patientPk(patientId),
    sk: patientSk,
    patientSk,
  });
}

async function main() {
  const outputs = await readOutputs();
  const TableName = requireOutput(outputs, 'TableName');
  const dataset = readMedicalDataset();
  const seededAt = new Date().toISOString();
  const summary = {
    patients: 0,
    records: 0,
    examinations: 0,
    prescriptions: 0,
    documents: 0,
    labResults: 0,
  };

  for (const patient of dataset.patients || []) {
    await put(TableName, {
      pk: patientPk(patient.patientId),
      sk: 'PROFILE',
      entityType: 'PATIENT',
      status: 'ACTIVE',
      createdBy: 'SEED_SCRIPT',
      createdAt: seededAt,
      updatedAt: seededAt,
      ...patient,
    });
    summary.patients += 1;
  }

  for (const [index, record] of (dataset.records || []).entries()) {
    const createdAt = new Date(
      Date.now() - (dataset.records.length - index) * 60_000,
    ).toISOString();
    await putProjection(
      TableName,
      'RECORD',
      record.recordId,
      record.patientId,
      'RECORD',
      {
        entityType: 'MEDICAL_RECORD',
        createdBy: 'SEED_SCRIPT',
        createdAt,
        updatedAt: createdAt,
        ...record,
      },
    );
    summary.records += 1;
  }

  for (const [index, examination] of (
    dataset.examinations || []
  ).entries()) {
    const createdAt = new Date(
      Date.now() - (dataset.examinations.length - index) * 50_000,
    ).toISOString();
    await putProjection(
      TableName,
      'EXAMINATION',
      examination.examinationId,
      examination.patientId,
      'EXAM',
      {
        entityType: 'EXAMINATION',
        createdBy: 'SEED_SCRIPT',
        createdAt,
        updatedAt: createdAt,
        ...examination,
      },
    );
    summary.examinations += 1;
  }

  for (const [index, prescription] of (
    dataset.prescriptions || []
  ).entries()) {
    const createdAt = new Date(
      Date.now() - (dataset.prescriptions.length - index) * 40_000,
    ).toISOString();
    await putProjection(
      TableName,
      'PRESCRIPTION',
      prescription.prescriptionId,
      prescription.patientId,
      'PRESCRIPTION',
      {
        entityType: 'PRESCRIPTION',
        status: 'ACTIVE',
        createdBy: 'SEED_SCRIPT',
        createdAt,
        updatedAt: createdAt,
        ...prescription,
      },
    );
    summary.prescriptions += 1;
  }

  for (const [index, labResult] of (dataset.labResults || []).entries()) {
    const createdAt = new Date(
      Date.now() - (dataset.labResults.length - index) * 20_000,
    ).toISOString();
    await putProjection(
      TableName,
      'LAB_RESULT',
      labResult.labResultId,
      labResult.patientId,
      'LAB_RESULT',
      {
        entityType: 'LAB_RESULT',
        createdBy: 'SEED_SCRIPT',
        createdAt,
        updatedAt: createdAt,
        ...labResult,
      },
    );
    summary.labResults += 1;
  }

  for (const [index, document] of (dataset.documents || []).entries()) {
    const createdAt = new Date(
      Date.now() - (dataset.documents.length - index) * 30_000,
    ).toISOString();
    await putProjection(
      TableName,
      'DOCUMENT',
      document.documentId,
      document.patientId,
      'DOCUMENT',
      {
        entityType: 'MEDICAL_DOCUMENT',
        key: `demo/${document.patientId}/${document.documentId}/${document.fileName}`,
        expectedFileSize: 0,
        uploadedBy: 'SEED_SCRIPT',
        createdAt,
        updatedAt: createdAt,
        ...document,
      },
    );
    summary.documents += 1;
  }

  console.log('Medical Week 1 seed completed');
  console.table(summary);
  console.log(`DynamoDB table: ${TableName}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
