const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const tableName = process.env.TABLE_NAME || process.argv[2];
const region = process.env.AWS_REGION || 'ap-southeast-1';

if (!tableName) {
  console.error('Error: TABLE_NAME is required.');
  console.error('Usage: TABLE_NAME=MyTable node scripts/verify-dataset.js');
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const queries = [
  { name: 'Medical test catalog', pk: 'XETNGHIEM' },
  { name: 'Medicine catalog', pk: 'MEDICINE' },
  { name: 'Rooms in Khoa Noi', pk: 'DEPARTMENT#KHOA-NOI' },
  { name: 'Medical record for HSBA#HSBA001', pk: 'HSBA#HSBA001' },
  { name: 'Prescription details for DONTHUOC#DT001', pk: 'DONTHUOC#DT001' },
];

const scans = [
  { name: 'Items with entityType XETNGHIEM', entityType: 'XETNGHIEM' },
  { name: 'Items with entityType HSBA', entityType: 'HSBA' },
  { name: 'Items with entityType DONTHUOC', entityType: 'DONTHUOC' },
  { name: 'Items with entityType YEUCAUXETNGHIEM', entityType: 'YEUCAUXETNGHIEM' },
  { name: 'Items with entityType KETQUAXETNGHIEM', entityType: 'KETQUAXETNGHIEM' },
  { name: 'Items with entityType PHIEUKHAM', entityType: 'PHIEUKHAM' },
];

async function run() {
  console.log(`Table: ${tableName}`);
  console.log(`Region: ${region}`);

  for (const q of queries) {
    const cmd = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': q.pk },
      Limit: 10,
    });

    try {
      const res = await client.send(cmd);
      const items = res.Items || [];
      console.log(`\n${q.name}: found ${items.length} item(s)`);
      if (items.length) console.log('Sample:', JSON.stringify(items[0], null, 2));
    } catch (err) {
      console.error(`Query failed for ${q.name}:`, err);
    }
  }

  // Additional scans by entityType to detect items stored under unexpected pk values
  for (const s of scans) {
    try {
      const cmd = new ScanCommand({
        TableName: tableName,
        FilterExpression: 'entityType = :etype',
        ExpressionAttributeValues: { ':etype': s.entityType },
        Limit: 10,
      });

      const res = await client.send(cmd);
      const items = res.Items || [];
      console.log(`\n${s.name}: found ${items.length} item(s)`);
      if (items.length) console.log('Sample:', JSON.stringify(items[0], null, 2));
    } catch (err) {
      console.error(`Scan failed for ${s.name}:`, err);
    }
  }

  console.log('\nDataset verification finished.');
}

run().catch((e) => {
  console.error('Verify dataset error:', e);
  process.exit(1);
});
