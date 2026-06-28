#!/usr/bin/env node
'use strict';

const cdk = require('aws-cdk-lib');
const { HospitalStack } = require('../lib/hospital-stack');

const app = new cdk.App();

const deployTarget = String(process.env.DEPLOY_TARGET || 'app')
  .trim()
  .toLowerCase();

if (deployTarget !== 'app') {
  throw new Error(
    'Dự án đang sử dụng CloudFront Free plan. ' +
      'DEPLOY_TARGET phải là "app"; không triển khai HospitalEdgeStack.',
  );
}

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region =
  process.env.APPLICATION_REGION ||
  process.env.CDK_DEFAULT_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

const enableCloudFront =
  String(process.env.ENABLE_CLOUDFRONT || 'true')
    .trim()
    .toLowerCase() === 'true';

const webAclArn = String(
  process.env.CLOUDFRONT_WEB_ACL_ARN || '',
).trim();

if (enableCloudFront && !webAclArn) {
  throw new Error(
    'CLOUDFRONT_WEB_ACL_ARN đang trống. ' +
      'Hãy lấy Web ACL hiện đang gắn với CloudFront Free plan trước khi synth/deploy.',
  );
}

new HospitalStack(app, 'HospitalDevStack', {
  stackName: process.env.STACK_NAME || 'HospitalDevStack',
  env: {
    account,
    region,
  },
  edgeSecurity: {
    enabled: enableCloudFront,
    webAclArn: enableCloudFront ? webAclArn : undefined,
  },
  description:
    'Project_Hospital_AWS_P2TB - CloudFront Free plan, external ChatAI API, monitoring, audit and backup.',
  tags: {
    Project: 'Project_Hospital_AWS_P2TB',
    Team: 'P2TB',
    Environment: 'dev',
    Owner: 'KhanhTam',
    Weeks: '1-2-3',
    DomainMode: 'cloudfront-net',
    AiProvider: 'external-api',
  },
});
