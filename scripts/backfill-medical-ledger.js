#!/usr/bin/env node
'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} = require('@aws-sdk/lib-dynamodb');

const {
  buildLedgerBlock,
  createAuditEvent,
  isMedicalRecordEntity,
  ledgerPartitionKey,
} = require('../services/medical-audit/domain');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const tableName = arg('table', process.env.TABLE_NAME);
if (!tableName) {
  console.error('Missing table name. Use --table <DynamoDBTableName> or set TABLE_NAME.');
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function scanAll() {
  const items = [];
  let ExclusiveStartKey;
  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey,
      }),
    );
    items.push(...(response.Items || []));
    ExclusiveStartKey = response.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function getLatestBlock(recordId) {
  const response = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': ledgerPartitionKey(recordId),
        ':prefix': 'BLOCK#',
      },
      ScanIndexForward: false,
      Limit: 1,
    }),
  );
  return response.Items?.[0] || null;
}

async function eventAlreadyBackfilled(eventId) {
  const response = await client.send(
    new ScanCommand({
      TableName: tableName,
      FilterExpression: 'entityType = :type AND eventId = :eventId',
      ExpressionAttributeValues: {
        ':type': 'MEDICAL_LEDGER_BLOCK',
        ':eventId': eventId,
      },
      Limit: 1,
    }),
  );
  return Boolean(response.Items?.length);
}

async function putAuditAndBlock(auditEvent, block) {
  const audit = {
    pk: `MEDICAL_RECORD_AUDIT#${auditEvent.medicalRecordId.toUpperCase()}`,
    sk: `${auditEvent.occurredAt}#${auditEvent.eventId}`,
    gsi1pk: `AUDIT_EVENT#${auditEvent.eventId}`,
    gsi1sk: 'METADATA',
    entityType: 'MEDICAL_AUDIT',
    ...auditEvent,
    blockchainMode: 'DYNAMODB_HASH_ONLY',
    blockchainStatus: 'HASH_ONLY',
    ledgerBlockId: block.ledgerBlockId,
    ledgerBlockNumber: block.blockNumber,
    ledgerBlockHash: block.blockHash,
    previousHash: block.previousHash,
    auditUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: block,
      ConditionExpression: 'attribute_not_exists(pk)',
    }),
  );
  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: audit,
    }),
  );
}

async function main() {
  console.log(`Scanning table ${tableName}...`);
  const allItems = await scanAll();
  const events = allItems
    .filter(isMedicalRecordEntity)
    .map((item) =>
      createAuditEvent({
        eventName: 'INSERT',
        item,
        occurredAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      }),
    )
    .filter(Boolean)
    .sort((left, right) =>
      `${left.medicalRecordId}|${left.occurredAt}|${left.eventId}`.localeCompare(
        `${right.medicalRecordId}|${right.occurredAt}|${right.eventId}`,
      ),
    );

  let created = 0;
  let skipped = 0;
  const latestByRecord = new Map();

  for (const event of events) {
    if (await eventAlreadyBackfilled(event.eventId)) {
      skipped += 1;
      continue;
    }

    let latest = latestByRecord.get(event.medicalRecordId);
    if (!latest) latest = await getLatestBlock(event.medicalRecordId);

    const block = buildLedgerBlock({
      auditEvent: event,
      previousHash: latest?.blockHash || 'GENESIS',
      blockNumber: Number(latest?.blockNumber || 0) + 1,
      createdAt: new Date().toISOString(),
    });

    await putAuditAndBlock(event, block);
    latestByRecord.set(event.medicalRecordId, block);
    created += 1;
    console.log(`Backfilled ${event.resourceType} ${event.resourceId} -> ${block.blockHash.slice(0, 12)}...`);
  }

  console.log(`Backfill complete. Created ${created} blocks, skipped ${skipped} existing events.`);
}

main().catch((error) => {
  console.error('Ledger backfill failed:', error);
  process.exit(1);
});
