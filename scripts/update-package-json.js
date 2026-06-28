'use strict';

const fs = require('fs');
const path = require('path');

const packagePath = path.resolve(__dirname, '..', 'package.json');

if (!fs.existsSync(packagePath)) {
  throw new Error(`Không tìm thấy package.json tại ${packagePath}`);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  outputs: 'node scripts/export-outputs.js',
  'test:ai': 'node scripts/test-external-ai.js',
  'verify:no-bedrock': 'node scripts/verify-no-bedrock.js',
};

fs.writeFileSync(
  packagePath,
  `${JSON.stringify(packageJson, null, 2)}\n`,
  'utf8',
);

console.log('Đã cập nhật scripts trong package.json.');
console.log('Tiếp theo chạy: npm install @aws-sdk/client-secrets-manager');
