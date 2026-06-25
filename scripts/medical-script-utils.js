'use strict';

const fs = require('fs');
const path = require('path');
const {
  CloudFormationClient,
  DescribeStacksCommand,
} = require('@aws-sdk/client-cloudformation');

const projectRoot = path.resolve(__dirname, '..');
const region =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';
const stackName = process.env.STACK_NAME || 'HospitalDevStack';

async function readOutputs() {
  const client = new CloudFormationClient({ region });

  try {
    const response = await client.send(
      new DescribeStacksCommand({ StackName: stackName }),
    );
    const stack = response.Stacks?.[0];
    if (!stack) throw new Error(`Stack ${stackName} was not found`);

    return {
      region,
      stackName,
      accountId: stack.StackId?.split(':')[4] || undefined,
      ...Object.fromEntries(
        (stack.Outputs || []).map((output) => [
          output.OutputKey,
          output.OutputValue,
        ]),
      ),
    };
  } catch (error) {
    if (process.env.ALLOW_LOCAL_OUTPUTS !== 'true') {
      throw new Error(
        `Unable to read live CloudFormation outputs for ${stackName}: ${error.message}`,
      );
    }

    const localFile = path.join(projectRoot, 'docs', 'aws-dev-outputs.json');
    if (!fs.existsSync(localFile)) {
      throw error;
    }

    const local = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    return { region, stackName, ...local };
  }
}

function readMedicalDataset() {
  const file = path.join(projectRoot, 'dataset', 'medical-week1.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Missing dataset file: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function requireOutput(outputs, key) {
  if (!outputs[key]) throw new Error(`Missing CloudFormation output: ${key}`);
  return outputs[key];
}

module.exports = {
  projectRoot,
  readMedicalDataset,
  readOutputs,
  region,
  requireOutput,
  stackName,
};
