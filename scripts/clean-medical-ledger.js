'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const tableName = process.argv[2];

if (!tableName) {
  console.error('Usage: node scripts/clean-medical-ledger.js <tableName>');
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

const LEDGER_TYPES = new Set([
  'MEDICAL_LEDGER_BLOCK',
  'MEDICAL_AUDIT',
  'MEDICAL_BLOCK',
  'BLOCKCHAIN_BLOCK',
  'INTEGRITY_BLOCK',
]);

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

async function main() {
  console.log(`Scanning ${tableName}...`);
  const items = await scanAll();

  const targets = items.filter((item) => {
    const entityType = String(item.entityType || '').toUpperCase();
    const pk = String(item.pk || '').toUpperCase();

    return (
      LEDGER_TYPES.has(entityType) ||
      pk.startsWith('MEDICAL_LEDGER#') ||
      pk.startsWith('MEDICAL_RECORD_AUDIT#')
    );
  });

  console.log(`Found ${targets.length} ledger/audit items to delete.`);

  let deleted = 0;

  for (const item of targets) {
    if (!item.pk || !item.sk) continue;

    await client.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
      }),
    );

    deleted += 1;

    if (deleted % 25 === 0) {
      console.log(`Deleted ${deleted}/${targets.length}`);
    }
  }

  console.log(`Deleted ${deleted} ledger/audit items successfully.`);
}

main().catch((error) => {
  console.error('Clean ledger failed:', error);
  process.exit(1);
});
