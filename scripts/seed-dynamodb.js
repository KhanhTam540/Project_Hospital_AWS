'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const {
  loadDatasetFiles,
  validateDataset,
  withoutInternalFields,
  chunk,
  sleep,
} = require('./dataset-utils');

const tableName = process.env.TABLE_NAME;
if (!tableName) {
  console.error('Missing TABLE_NAME environment variable');
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function writeBatch(items) {
  let pendingRequests = items.map((item) => ({
    PutRequest: { Item: withoutInternalFields(item) },
  }));

  for (let attempt = 1; pendingRequests.length > 0 && attempt <= 8; attempt += 1) {
    const response = await ddb.send(
      new BatchWriteCommand({
        RequestItems: { [tableName]: pendingRequests },
      }),
    );

    pendingRequests = response.UnprocessedItems?.[tableName] || [];
    if (pendingRequests.length > 0) {
      await sleep(Math.min(200 * 2 ** attempt, 5000));
    }
  }

  if (pendingRequests.length > 0) {
    throw new Error(`Could not write ${pendingRequests.length} items after retries`);
  }
}

async function main() {
  const { fileNames, items } = loadDatasetFiles();
  validateDataset(items);

  console.log(`Loaded ${items.length} items from ${fileNames.length} dataset files`);
  console.log(`Target table: ${tableName}`);

  let written = 0;
  for (const batch of chunk(items, 25)) {
    await writeBatch(batch);
    written += batch.length;
    console.log(`Seeded ${written}/${items.length} items`);
  }

  console.log('Seed completed successfully');
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
