'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const packageFile = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));

packageJson.scripts = {
  ...(packageJson.scripts || {}),
  'test:medical': 'node --test tests/medical-handler.test.js',
  'seed:medical': 'node scripts/seed-medical-data.js',
  'verify:medical': 'node scripts/verify-medical-data.js',
  'tokens:medical': 'node scripts/get-demo-tokens.js',
  'test:medical:api': 'node scripts/test-medical-api.js',
};

packageJson.dependencies = {
  ...(packageJson.dependencies || {}),
  '@aws-sdk/client-cloudformation':
    packageJson.dependencies?.['@aws-sdk/client-cloudformation'] || '^3.850.0',
  '@aws-sdk/client-cognito-identity-provider':
    packageJson.dependencies?.[
      '@aws-sdk/client-cognito-identity-provider'
    ] || '^3.850.0',
  '@aws-sdk/client-dynamodb':
    packageJson.dependencies?.['@aws-sdk/client-dynamodb'] || '^3.850.0',
  '@aws-sdk/client-s3':
    packageJson.dependencies?.['@aws-sdk/client-s3'] || '^3.850.0',
  '@aws-sdk/lib-dynamodb':
    packageJson.dependencies?.['@aws-sdk/lib-dynamodb'] || '^3.850.0',
  '@aws-sdk/s3-request-presigner':
    packageJson.dependencies?.['@aws-sdk/s3-request-presigner'] || '^3.850.0',
};

fs.writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log('package.json updated with Medical Week 1 commands');
