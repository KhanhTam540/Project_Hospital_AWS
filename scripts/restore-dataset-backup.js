'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const name = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[name] = true;
    else {
      result[name] = next;
      index += 1;
    }
  }
  return result;
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

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

async function batchWrite(ddb, tableName, requests) {
  for (const group of chunk(requests, 25)) {
    let pending = group;
    for (let attempt = 1; pending.length && attempt <= 10; attempt += 1) {
      const response = await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: pending } }));
      pending = response.UnprocessedItems?.[tableName] || [];
      if (pending.length) await new Promise((resolve) => setTimeout(resolve, Math.min(200 * 2 ** attempt, 5000)));
    }
    if (pending.length) throw new Error(`Unable to process ${pending.length} DynamoDB requests`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.confirmation !== 'RESTORE-HOSPITAL-DATA') {
    throw new Error('Refusing restore. Pass --confirmation RESTORE-HOSPITAL-DATA');
  }
  if (!args.backup) throw new Error('Pass --backup <path-to-dynamodb-items.json>');
  const backupPath = path.resolve(args.backup);
  if (!fs.existsSync(backupPath)) throw new Error(`Backup file not found: ${backupPath}`);
  const backupItems = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  if (!Array.isArray(backupItems)) throw new Error('Backup file must contain a JSON array');

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-1';
  const stackName = process.env.STACK_NAME || 'HospitalDevStack';
  const outputs = await stackOutputs(region, stackName);
  const tableName = process.env.TABLE_NAME || outputs.TableName;
  if (!tableName) throw new Error('Missing TableName output');

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
  const currentItems = await scanAll(ddb, tableName);
  console.log(`Deleting ${currentItems.length} current items before restore...`);
  await batchWrite(ddb, tableName, currentItems.map((item) => ({ DeleteRequest: { Key: { pk: item.pk, sk: item.sk } } })));
  console.log(`Restoring ${backupItems.length} backup items...`);
  await batchWrite(ddb, tableName, backupItems.map((item) => ({ PutRequest: { Item: item } })));
  console.log('Backup restore completed successfully.');
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
