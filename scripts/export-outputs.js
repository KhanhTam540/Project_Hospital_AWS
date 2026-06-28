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
  process.env.APPLICATION_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

async function main() {
  const client = new CloudFormationClient({ region });
  const response = await client.send(
    new DescribeStacksCommand({
      StackName: stackName,
    }),
  );

  const stack = response.Stacks?.[0];

  if (!stack) {
    throw new Error(`Không tìm thấy stack ${stackName} tại ${region}.`);
  }

  const outputs = Object.fromEntries(
    (stack.Outputs || []).map((item) => [
      item.OutputKey,
      item.OutputValue,
    ]),
  );

  const requiredOutputs = [
    'ApiEndpoint',
    'UserPoolId',
    'WebClientId',
    'TableName',
  ];

  const missing = requiredOutputs.filter((name) => !outputs[name]);

  if (missing.length > 0) {
    throw new Error(
      `Thiếu CloudFormation outputs: ${missing.join(', ')}`,
    );
  }

  const docsDirectory = path.join(projectRoot, 'docs');
  const webDirectory = path.join(projectRoot, 'web');

  fs.mkdirSync(docsDirectory, { recursive: true });
  fs.mkdirSync(webDirectory, { recursive: true });

  const outputFile = path.join(
    docsDirectory,
    'aws-dev-outputs.json',
  );

  const result = {
  stackName,

  stackStatus:
    stack.StackStatus,

  accountId:
    stack.StackId?.split(':')[4] ||
    undefined,

  ...outputs,
};

  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  const frontendApiUrl = outputs.CloudFrontUrl || outputs.ApiEndpoint;

  const envLines = [
    `VITE_API_URL=${frontendApiUrl}`,
    `VITE_AWS_REGION=${region}`,
    `VITE_COGNITO_USER_POOL_ID=${outputs.UserPoolId}`,
    `VITE_COGNITO_CLIENT_ID=${outputs.WebClientId}`,
    `VITE_CLOUDFRONT_URL=${outputs.CloudFrontUrl || ''}`,
  ];

  const envFile = path.join(
    webDirectory,
    '.env.local.generated',
  );

  fs.writeFileSync(
    envFile,
    `${envLines.join('\n')}\n`,
    'utf8',
  );

  console.log(`Đã lưu outputs: ${outputFile}`);
  console.log(`Đã tạo frontend env: ${envFile}`);
  console.log(`Stack status: ${stack.StackStatus}`);

  if (outputs.CloudFrontUrl) {
    console.log(`CloudFront URL: ${outputs.CloudFrontUrl}`);
  }

  if (outputs.AiFunctionName) {
    console.log(`External AI Lambda: ${outputs.AiFunctionName}`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
