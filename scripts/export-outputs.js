const fs = require('fs');
const path = require('path');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');

const stackName = process.env.STACK_NAME || 'HospitalDevStack';
const region =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

const client = new CloudFormationClient({ region });

const main = async () => {
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
    'CloudFrontDistributionId',
    'CloudFrontUrl',
    'FrontendBucketName',
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

  const outputFile = path.resolve(
    __dirname,
    '..',
    'docs',
    'aws-dev-outputs.json',
  );
  fs.writeFileSync(
    outputFile,
    `${JSON.stringify({ stackName, region, ...outputs }, null, 2)}\n`,
  );

  const webEnvFile = path.resolve(
    __dirname,
    '..',
    'web',
    '.env.production.local',
  );
  fs.writeFileSync(
    webEnvFile,
    [
      `VITE_AWS_REGION=${region}`,
      `VITE_COGNITO_USER_POOL_ID=${outputs.UserPoolId}`,
      `VITE_COGNITO_WEB_CLIENT_ID=${outputs.WebClientId}`,
      'VITE_API_BASE_URL=',
      '',
    ].join('\n'),
  );

  const localEnvExample = path.resolve(
    __dirname,
    '..',
    'web',
    '.env.local.generated',
  );
  fs.writeFileSync(
    localEnvExample,
    [
      `VITE_AWS_REGION=${region}`,
      `VITE_COGNITO_USER_POOL_ID=${outputs.UserPoolId}`,
      `VITE_COGNITO_WEB_CLIENT_ID=${outputs.WebClientId}`,
      `VITE_API_BASE_URL=${outputs.ApiEndpoint}`,
      '',
    ].join('\n'),
  );

  console.log(`Saved outputs to ${outputFile}`);
  console.log(`Saved production web environment to ${webEnvFile}`);
  console.log(
    `For local development, copy ${localEnvExample} to web/.env.local`,
  );
};

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
