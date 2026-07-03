'use strict';

const fs = require('fs');
const path = require('path');

function loadOutputs() {
  const outputPath = path.resolve(
    __dirname,
    '..',
    'docs',
    'aws-dev-outputs.json',
  );

  if (!fs.existsSync(outputPath)) {
    throw new Error('Chưa có docs/aws-dev-outputs.json. Hãy chạy npm run outputs.');
  }

  return JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

async function main() {
  const outputs = loadOutputs();
  const token = String(process.env.AI_TEST_ID_TOKEN || '').trim();

  if (!token) {
    throw new Error('Thiếu AI_TEST_ID_TOKEN. Hãy đặt Cognito ID token trước khi test.');
  }

  const baseUrl = String(
    process.env.AI_TEST_BASE_URL ||
      outputs.CloudFrontUrl ||
      outputs.ApiEndpoint ||
      '',
  ).replace(/\/$/, '');

  if (!baseUrl) {
    throw new Error('Không tìm thấy CloudFrontUrl hoặc ApiEndpoint.');
  }

  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Tôi cần chuẩn bị những giấy tờ chung nào trước khi đi khám?',
      context: 'Đây là câu hỏi hướng dẫn chung, không có dữ liệu bệnh án.',
    }),
  });

  const text = await response.text();

  console.log(`Status: ${response.status}`);
  console.log(text);

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
