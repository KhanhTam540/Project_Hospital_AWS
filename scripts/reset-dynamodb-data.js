'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { SAMPLE_SOURCE, chunk, sleep } = require('./dataset-utils');

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  console.error('Missing TABLE_NAME environment variable');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function findSampleKeys() {
  const keys = [];
  let exclusiveStartKey;

  do {
    const response = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: '#dataSource = :sample',
        ProjectionExpression: 'pk, sk',
        ExpressionAttributeNames: { '#dataSource': 'dataSource' },
        ExpressionAttributeValues: { ':sample': SAMPLE_SOURCE },
      }),
    );

    keys.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return keys;
}

async function deleteBatch(keys) {
  let pendingRequests = keys.map((key) => ({ DeleteRequest: { Key: key } }));

  for (let attempt = 1; pendingRequests.length > 0 && attempt <= 8; attempt += 1) {
    const response = await ddb.send(
      new BatchWriteCommand({ RequestItems: { [tableName]: pendingRequests } }),
    );
    pendingRequests = response.UnprocessedItems?.[tableName] || [];
    if (pendingRequests.length > 0) await sleep(Math.min(200 * 2 ** attempt, 5000));
  }

  if (pendingRequests.length > 0) {
    throw new Error(`Could not delete ${pendingRequests.length} items after retries`);
  }
}

async function main() {
  const keys = await findSampleKeys();
  if (keys.length === 0) {
    console.log('No P2TB sample items found');
    return;
  }

  let deleted = 0;
  for (const batch of chunk(keys, 25)) {
    await deleteBatch(batch);
    deleted += batch.length;
    console.log(`Deleted ${deleted}/${keys.length} sample items`);
  }

  console.log('Sample reset completed successfully');
}

main().catch((error) => {
  console.error('Reset failed:', error);
  process.exitCode = 1;
});
