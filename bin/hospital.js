#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { HospitalStack } = require('../lib/hospital-stack');

const app = new cdk.App();
const region =
  app.node.tryGetContext('region') ||
  process.env.CDK_DEFAULT_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

new HospitalStack(app, 'HospitalDevStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
  },
  description:
    'Hospital Week 1 serverless platform: Cognito, HTTP API, Lambda, DynamoDB, S3 and CloudFront.',
  tags: {
    Project: 'Hospital',
    Environment: 'dev',
    Owner: 'KhanhTam',
    Week: '1',
  },
});
