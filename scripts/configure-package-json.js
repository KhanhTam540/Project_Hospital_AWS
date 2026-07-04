'use strict';

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  test: 'node --test tests/*.test.js',
  'seed:data': 'node scripts/seed-dynamodb.js',
  'verify:data': 'node scripts/verify-dynamodb-data.js',
  'reset:data': 'node scripts/reset-dynamodb-data.js',
};

fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log('package.json scripts updated successfully');
