'use strict';

const fs = require('fs');
const path = require('path');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');

const projectRoot = path.resolve(__dirname, '..');
const stackName = process.env.STACK_NAME || 'HospitalDevStack';
const region =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

const client = new CloudFormationClient({ region });

function normalizeBaseUrl(value = '') {
  return String(value).replace(/\/$/, '');
}

function writeWebEnv(filePath, apiBaseUrl, outputs) {
  fs.writeFileSync(
    filePath,
    [
      `VITE_API_BASE_URL=${apiBaseUrl}`,
      'VITE_COGNITO_ENABLED=true',
      `VITE_COGNITO_REGION=${region}`,
      `VITE_COGNITO_USER_POOL_ID=${outputs.UserPoolId}`,
      `VITE_COGNITO_CLIENT_ID=${outputs.WebClientId}`,
      'VITE_GOOGLE_CLIENT_ID=',
      '',
    ].join('\n'),
  );
}

async function main() {
  const response = await client.send(
    new DescribeStacksCommand({ StackName: stackName }),
  );
  const stack = response.Stacks?.[0];
  if (!stack) {
    throw new Error(`Stack ${stackName} was not found in ${region}`);
  }

  const outputs = Object.fromEntries(
    (stack.Outputs || []).map((output) => [
      output.OutputKey,
      output.OutputValue,
    ]),
  );

  const required = [
    'ApiEndpoint',
    'MedicalBucketName',
    'MobileClientId',
    'TableName',
    'UserPoolId',
    'WebClientId',
  ];

  for (const key of required) {
    if (!outputs[key]) {
      throw new Error(`Missing CloudFormation output: ${key}`);
    }
  }

  const cloudFrontEnabled = Boolean(
    outputs.CloudFrontDistributionId &&
      outputs.CloudFrontUrl &&
      outputs.FrontendBucketName,
  );

  const accountId = stack.StackId?.split(':')[4] || undefined;
  const outputFile = path.join(
    projectRoot,
    'docs',
    'aws-dev-outputs.json',
  );

  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        stackName,
        region,
        accountId,
        ...outputs,
      },
      null,
      2,
    )}\n`,
  );

  const localApiBaseUrl = `${normalizeBaseUrl(outputs.ApiEndpoint)}/api`;
  writeWebEnv(
    path.join(projectRoot, 'web', '.env.local.generated'),
    localApiBaseUrl,
    outputs,
  );

  if (cloudFrontEnabled) {
    writeWebEnv(
      path.join(projectRoot, 'web', '.env.production.local'),
      '/api',
      outputs,
    );
  }

  console.log(`Saved outputs to ${outputFile}`);
  console.log('Saved local frontend config to web/.env.local.generated');
  if (cloudFrontEnabled) {
    console.log('Saved production frontend config to web/.env.production.local');
  } else {
    console.log('CloudFront outputs were not found; production config was not written.');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
