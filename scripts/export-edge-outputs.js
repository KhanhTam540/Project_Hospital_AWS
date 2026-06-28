'use strict';

const fs = require('fs');
const path = require('path');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');

const projectRoot = path.resolve(__dirname, '..');
const stackName = process.env.EDGE_STACK_NAME || 'HospitalEdgeStack';
const region = process.env.EDGE_REGION || 'us-east-1';
const client = new CloudFormationClient({ region });

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

  if (!outputs.WebAclArn) {
    throw new Error('Missing edge CloudFormation output: WebAclArn');
  }

  const outputFile = path.join(
    projectRoot,
    'docs',
    'aws-edge-outputs.json',
  );

  fs.writeFileSync(
    outputFile,
    `${JSON.stringify(
      {
        stackName,
        region,
        accountId: stack.StackId?.split(':')[4] || undefined,
        ...outputs,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Saved edge outputs to ${outputFile}`);
  console.log(
    `$env:CLOUDFRONT_WEB_ACL_ARN = "${outputs.WebAclArn}"`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
