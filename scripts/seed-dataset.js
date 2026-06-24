
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { buildDataset } = require("../src/data/hospital-dataset");

const tableName = process.env.TABLE_NAME || process.argv[2];
const region = process.env.AWS_REGION || "ap-southeast-1";

if (!tableName) {
  console.error("❌ Lỗi: Thiếu TABLE_NAME. Hãy truyền qua biến môi trường hoặc tham số!");
  process.exit(1);
}

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

async function runSeed() {
  const allItems = buildDataset();
  console.log(`📌 Bảng mục tiêu: ${tableName}`);
  console.log(`📌 Vùng triển khai (Region): ${region}`);
  console.log(`📌 Tổng số lượng item: ${allItems.length}`);

  const chunks = [];
  for (let i = 0; i < allItems.length; i += 25) {
    chunks.push(allItems.slice(i, i + 25));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const putRequests = chunk.map(item => ({
      PutRequest: { Item: item }
    }));

    const command = new BatchWriteCommand({
      RequestItems: {
        [tableName]: putRequests
      }
    });

    try {
      await docClient.send(command);
      console.log(`✅ Đã ghi thành công batch ${i + 1}/${chunks.length}.`);
    } catch (err) {
      console.error(`❌ Ghi lỗi tại batch ${i + 1}:`, err);
    }
  }

  console.log("🎉 Toàn bộ Dataset Hospital đã được nạp thành công!");
}

runSeed();