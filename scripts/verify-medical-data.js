'use strict';

const {
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetPublicAccessBlockCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  readMedicalDataset,
  readOutputs,
  requireOutput,
} = require('./medical-script-utils');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

async function get(TableName, pk, sk) {
  const response = await ddb.send(
    new GetCommand({ TableName, Key: { pk, sk }, ConsistentRead: true }),
  );
  return response.Item;
}

async function queryPrefix(TableName, patientId, prefix) {
  const response = await ddb.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `PATIENT#${patientId}`,
        ':prefix': `${prefix}#`,
      },
    }),
  );
  return response.Items || [];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const outputs = await readOutputs();
  const TableName = requireOutput(outputs, 'TableName');
  const Bucket = requireOutput(outputs, 'MedicalBucketName');
  const dataset = readMedicalDataset();

  for (const patient of dataset.patients || []) {
    const item = await get(TableName, `PATIENT#${patient.patientId}`, 'PROFILE');
    assert(item, `Missing patient ${patient.patientId}`);
  }

  const patientIds = [...new Set((dataset.patients || []).map((p) => p.patientId))];
  let recordCount = 0;
  let examinationCount = 0;
  let prescriptionCount = 0;
  let documentCount = 0;

  for (const patientId of patientIds) {
    recordCount += (await queryPrefix(TableName, patientId, 'RECORD')).length;
    examinationCount += (
      await queryPrefix(TableName, patientId, 'EXAM')
    ).length;
    prescriptionCount += (
      await queryPrefix(TableName, patientId, 'PRESCRIPTION')
    ).length;
    documentCount += (
      await queryPrefix(TableName, patientId, 'DOCUMENT')
    ).length;
  }

  assert(recordCount >= 3, 'Expected at least 3 medical records');
  assert(examinationCount >= 2, 'Expected at least 2 examinations');
  assert(prescriptionCount >= 2, 'Expected at least 2 prescriptions');
  assert(documentCount >= 2, 'Expected at least 2 document metadata items');

  const [encryption, versioning, publicAccess] = await Promise.all([
    s3.send(new GetBucketEncryptionCommand({ Bucket })),
    s3.send(new GetBucketVersioningCommand({ Bucket })),
    s3.send(new GetPublicAccessBlockCommand({ Bucket })),
  ]);

  const encryptionRules =
    encryption.ServerSideEncryptionConfiguration?.Rules || [];
  assert(
    encryptionRules.some(
      (rule) =>
        rule.ApplyServerSideEncryptionByDefault?.SSEAlgorithm === 'aws:kms',
    ),
    'Medical bucket is not encrypted with AWS KMS',
  );
  assert(versioning.Status === 'Enabled', 'Medical bucket versioning is off');

  const block = publicAccess.PublicAccessBlockConfiguration || {};
  assert(
    block.BlockPublicAcls &&
      block.IgnorePublicAcls &&
      block.BlockPublicPolicy &&
      block.RestrictPublicBuckets,
    'Medical bucket public access block is incomplete',
  );

  console.log('Medical Week 1 verification passed');
  console.table({
    patients: patientIds.length,
    records: recordCount,
    examinations: examinationCount,
    prescriptions: prescriptionCount,
    documents: documentCount,
  });
  console.log('S3 encryption: aws:kms');
  console.log('S3 versioning: Enabled');
  console.log('S3 public access: Blocked');
}

main().catch((error) => {
  console.error(`Verification failed: ${error.message}`);
  process.exitCode = 1;
});
