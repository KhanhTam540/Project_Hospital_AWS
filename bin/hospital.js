#!/usr/bin/env node
'use strict';

const cdk = require('aws-cdk-lib');

const {
  HospitalStack,
} = require('../lib/hospital-stack');

function envFlag(
  name,
  defaultValue = true,
) {
  const value = process.env[name];

  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return defaultValue;
  }

  return (
    String(value)
      .trim()
      .toLowerCase() === 'true'
  );
}

const app = new cdk.App();

/*
 * Project hiện chỉ triển khai application stack.
 * Không còn triển khai HospitalEdgeStack riêng.
 */
const deployTarget = String(
  process.env.DEPLOY_TARGET || 'app',
)
  .trim()
  .toLowerCase();

if (deployTarget !== 'app') {
  throw new Error(
    'DEPLOY_TARGET phải là "app". ' +
      'Project hiện chỉ triển khai HospitalDevStack.',
  );
}

/*
 * Account được CDK CLI tự động điền khi chạy với --profile.
 */
const account =
  process.env.CDK_DEFAULT_ACCOUNT;

/*
 * Region chính của ứng dụng.
 */
const region =
  process.env.APPLICATION_REGION ||
  process.env.CDK_DEFAULT_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'ap-southeast-1';

/*
 * Bật frontend S3/CloudFront integration.
 */
const enableCloudFront = envFlag(
  'ENABLE_CLOUDFRONT',
  true,
);

/*
 * true:
 *   Dùng distribution CloudFront Free/flat-rate plan đang tồn tại.
 *   CDK không tạo Distribution, OAC hoặc CloudFront Function mới.
 *
 * false:
 *   Cho phép CDK tạo một distribution mới.
 */
const useExistingCloudFront = envFlag(
  'USE_EXISTING_CLOUDFRONT',
  true,
);

const existingCloudFrontDistributionId =
  String(
    process.env
      .EXISTING_CLOUDFRONT_DISTRIBUTION_ID ||
      '',
  ).trim();

const existingCloudFrontDomain =
  String(
    process.env
      .EXISTING_CLOUDFRONT_DOMAIN ||
      '',
  )
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');

if (
  enableCloudFront &&
  useExistingCloudFront &&
  (
    !existingCloudFrontDistributionId ||
    !existingCloudFrontDomain
  )
) {
  throw new Error(
    'USE_EXISTING_CLOUDFRONT=true nhưng ' +
      'EXISTING_CLOUDFRONT_DISTRIBUTION_ID ' +
      'hoặc EXISTING_CLOUDFRONT_DOMAIN đang trống.',
  );
}

/*
 * Web ACL ARN hiện tại có thể được truyền vào để ghi output.
 * Khi dùng existing CloudFront, stack không gắn lại Web ACL này.
 */
const webAclArn = String(
  process.env.CLOUDFRONT_WEB_ACL_ARN ||
    '',
).trim();

/*
 * Chỉ cho phép CDK gắn WAF khi CDK thực sự tạo distribution mới.
 */
const edgeSecurityEnabled =
  enableCloudFront &&
  !useExistingCloudFront &&
  webAclArn.length > 0;

console.log(
  `[Hospital CDK] Account: ${
    account || '(resolved by CDK CLI)'
  }`,
);

console.log(
  `[Hospital CDK] Region: ${region}`,
);

console.log(
  '[Hospital CDK] CloudFront enabled: ' +
    `${enableCloudFront}`,
);

console.log(
  '[Hospital CDK] Use existing CloudFront: ' +
    `${useExistingCloudFront}`,
);

if (
  enableCloudFront &&
  useExistingCloudFront
) {
  console.log(
    '[Hospital CDK] Existing distribution: ' +
      existingCloudFrontDistributionId,
  );

  console.log(
    '[Hospital CDK] Existing domain: ' +
      existingCloudFrontDomain,
  );
}

console.log(
  '[Hospital CDK] CDK-managed WAF attachment: ' +
    `${edgeSecurityEnabled}`,
);

if (
  enableCloudFront &&
  !useExistingCloudFront &&
  !edgeSecurityEnabled
) {
  console.warn(
    '[Hospital CDK] ' +
      'CDK sẽ tạo CloudFront mới nhưng không gắn WAF ' +
      'vì CLOUDFRONT_WEB_ACL_ARN đang trống.',
  );
}

new HospitalStack(
  app,
  'HospitalDevStack',
  {
    stackName:
      process.env.STACK_NAME ||
      'HospitalDevStack',

    env: {
      account,
      region,
    },

    edgeSecurity: {
      enabled:
        edgeSecurityEnabled,

      /*
       * Vẫn truyền ARN khi dùng existing CloudFront để stack
       * có thể xuất lại thông tin, nhưng không gắn ARN vào
       * distribution mới vì distribution mới không được tạo.
       */
      webAclArn:
        webAclArn ||
        undefined,
    },

    description:
      'Project_Hospital_AWS_P2TB - ' +
      'existing CloudFront Free plan, ' +
      'external ChatAI API, monitoring, ' +
      'audit and backup.',

    tags: {
      Project:
        'Project_Hospital_AWS_P2TB',

      Team:
        'P2TB',

      Environment:
        'dev',

      Owner:
        'KhanhTam',

      Weeks:
        '1-2-3',

      DomainMode:
        enableCloudFront
          ? (
              useExistingCloudFront
                ? 'existing-cloudfront-net'
                : 'cdk-managed-cloudfront-net'
            )
          : 'local-development',

      AiProvider:
        'external-api',

      WafEnabled:
        webAclArn
          ? 'true'
          : 'false',
    },
  },
);
