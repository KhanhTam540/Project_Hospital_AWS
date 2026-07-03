'use strict';

const {
  Aws,
  Duration,
  RemovalPolicy,
} = require('aws-cdk-lib');

const backup = require('aws-cdk-lib/aws-backup');
const cloudtrail = require('aws-cdk-lib/aws-cloudtrail');
const cloudwatch = require('aws-cdk-lib/aws-cloudwatch');
const cloudwatchActions = require('aws-cdk-lib/aws-cloudwatch-actions');
const events = require('aws-cdk-lib/aws-events');
const logs = require('aws-cdk-lib/aws-logs');
const s3 = require('aws-cdk-lib/aws-s3');
const sns = require('aws-cdk-lib/aws-sns');
const subscriptions = require('aws-cdk-lib/aws-sns-subscriptions');
const iam = require('aws-cdk-lib/aws-iam');

function isEnabled(name, defaultValue = true) {
  const value = process.env[name];

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === 'true';
}

function addOperationsResources(scope, resources) {
  const {
    dataKey,
    table,
    medicalBucket,
    coreFunction,
    medicalFunction,
    aiAuditFunction,
    coreWorkerFunction,
    httpApi,
    backgroundTaskQueue,
    backgroundTaskDlq,
    retainData,
  } = resources;

  const removalPolicy = retainData
    ? RemovalPolicy.RETAIN
    : RemovalPolicy.DESTROY;

  const opsAlertTopic = new sns.Topic(
    scope,
    'HospitalOpsAlertTopic',
    {
      displayName: 'Hospital P2TB Operations Alerts',
      masterKey: dataKey,
      enforceSSL: true,
    },
  );
  opsAlertTopic.applyRemovalPolicy(removalPolicy);

  const alertEmail = String(process.env.ALERT_EMAIL || '').trim();

  if (alertEmail) {
    opsAlertTopic.addSubscription(
      new subscriptions.EmailSubscription(alertEmail),
    );
  }

  const alarmAction = new cloudwatchActions.SnsAction(opsAlertTopic);

  const monitoredFunctions = [
    ['Core', coreFunction],
    ['Medical', medicalFunction],
    ['AiAudit', aiAuditFunction],
    ['CoreWorker', coreWorkerFunction],
  ].filter(([, handler]) => Boolean(handler));

  for (const [name, handler] of monitoredFunctions) {
    const errorAlarm = new cloudwatch.Alarm(
      scope,
      `${name}FunctionErrorAlarm`,
      {
        alarmDescription: `${name} Lambda có ít nhất một lỗi trong 5 phút.`,
        metric: handler.metricErrors({
          period: Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    errorAlarm.addAlarmAction(alarmAction);

    const throttleAlarm = new cloudwatch.Alarm(
      scope,
      `${name}FunctionThrottleAlarm`,
      {
        alarmDescription: `${name} Lambda bị throttle.`,
        metric: handler.metricThrottles({
          period: Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      },
    );

    throttleAlarm.addAlarmAction(alarmAction);
  }

  const api5xxMetric = new cloudwatch.Metric({
    namespace: 'AWS/ApiGateway',
    metricName: '5xx',
    dimensionsMap: {
      ApiId: httpApi.apiId,
      Stage: '$default',
    },
    statistic: 'Sum',
    period: Duration.minutes(5),
  });

  const api5xxAlarm = new cloudwatch.Alarm(
    scope,
    'HospitalApi5xxAlarm',
    {
      alarmDescription: 'HTTP API trả lỗi máy chủ 5xx.',
      metric: api5xxMetric,
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    },
  );
  api5xxAlarm.addAlarmAction(alarmAction);

  const dlqAlarm = new cloudwatch.Alarm(
    scope,
    'BackgroundDlqAlarm',
    {
      alarmDescription: 'Dead-letter queue có message cần xử lý.',
      metric: backgroundTaskDlq.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    },
  );
  dlqAlarm.addAlarmAction(alarmAction);

  const queueAgeAlarm = new cloudwatch.Alarm(
    scope,
    'BackgroundQueueAgeAlarm',
    {
      alarmDescription: 'Message cũ nhất trong SQS vượt quá 5 phút.',
      metric: backgroundTaskQueue.metricApproximateAgeOfOldestMessage({
        period: Duration.minutes(5),
      }),
      threshold: 300,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    },
  );
  queueAgeAlarm.addAlarmAction(alarmAction);

  const dashboard = new cloudwatch.Dashboard(
    scope,
    'HospitalOperationsDashboard',
    {
      dashboardName: 'Hospital-P2TB-Operations',
    },
  );

  dashboard.addWidgets(
    new cloudwatch.GraphWidget({
      title: 'Lambda Invocations',
      left: monitoredFunctions.map(([, handler]) =>
        handler.metricInvocations({ period: Duration.minutes(5) }),
      ),
    }),
    new cloudwatch.GraphWidget({
      title: 'Lambda Errors',
      left: monitoredFunctions.map(([, handler]) =>
        handler.metricErrors({ period: Duration.minutes(5) }),
      ),
    }),
    new cloudwatch.GraphWidget({
      title: 'Lambda Duration p90',
      left: monitoredFunctions.map(([, handler]) =>
        handler.metricDuration({
          period: Duration.minutes(5),
          statistic: 'p90',
        }),
      ),
    }),
    new cloudwatch.GraphWidget({
      title: 'HTTP API 5xx',
      left: [api5xxMetric],
    }),
    new cloudwatch.GraphWidget({
      title: 'SQS Main Queue và DLQ',
      left: [
        backgroundTaskQueue.metricApproximateNumberOfMessagesVisible(),
        backgroundTaskDlq.metricApproximateNumberOfMessagesVisible(),
      ],
    }),
  );

/*
 * ============================================================
 * WEEK 3 - CLOUDTRAIL
 * ============================================================
 */

const trailName =
  'hospital-p2tb-audit-trail';

const trailArn =
  `arn:${Aws.PARTITION}:cloudtrail:` +
  `${Aws.REGION}:${Aws.ACCOUNT_ID}:` +
  `trail/${trailName}`;

const cloudTrailServicePrincipal =
  new iam.ServicePrincipal(
    'cloudtrail.amazonaws.com',
  );

const trailBucket = new s3.Bucket(
  scope,
  'HospitalCloudTrailBucket',
  {
    blockPublicAccess:
      s3.BlockPublicAccess.BLOCK_ALL,

    objectOwnership:
      s3.ObjectOwnership
        .BUCKET_OWNER_ENFORCED,

    encryption:
      s3.BucketEncryption.KMS,

    encryptionKey:
      dataKey,

    bucketKeyEnabled:
      true,

    enforceSSL:
      true,

    versioned:
      true,

    lifecycleRules: [
      {
        id:
          'DeleteOldCloudTrailLogs',

        expiration:
          Duration.days(30),
      },
    ],

    removalPolicy,

    autoDeleteObjects:
      !retainData,
  },
);

/*
 * CloudTrail cần kiểm tra ACL của bucket.
 */

trailBucket.addToResourcePolicy(
  new iam.PolicyStatement({
    sid:
      'AWSCloudTrailAclCheck20150319',

    effect:
      iam.Effect.ALLOW,

    principals: [
      cloudTrailServicePrincipal,
    ],

    actions: [
      's3:GetBucketAcl',
    ],

    resources: [
      trailBucket.bucketArn,
    ],

    conditions: {
      StringEquals: {
        'aws:SourceArn':
          trailArn,
      },
    },
  }),
);

/*
 * CloudTrail cần ghi log vào:
 *
 * s3://bucket/AWSLogs/<account-id>/
 */

trailBucket.addToResourcePolicy(
  new iam.PolicyStatement({
    sid:
      'AWSCloudTrailWrite20150319',

    effect:
      iam.Effect.ALLOW,

    principals: [
      cloudTrailServicePrincipal,
    ],

    actions: [
      's3:PutObject',
    ],

    resources: [
      trailBucket.arnForObjects(
        `AWSLogs/${Aws.ACCOUNT_ID}/*`,
      ),
    ],

    conditions: {
      StringEquals: {
        's3:x-amz-acl':
          'bucket-owner-full-control',

        'aws:SourceArn':
          trailArn,
      },
    },
  }),
);

/*
 * Cho CloudTrail tạo Data Key để mã hóa
 * log và digest file.
 */

dataKey.addToResourcePolicy(
  new iam.PolicyStatement({
    sid:
      'AllowCloudTrailEncryptLogs',

    effect:
      iam.Effect.ALLOW,

    principals: [
      cloudTrailServicePrincipal,
    ],

    actions: [
      'kms:GenerateDataKey*',
    ],

    resources: [
      '*',
    ],

    conditions: {
      StringEquals: {
        'aws:SourceArn':
          trailArn,
      },

      StringLike: {
        'kms:EncryptionContext:aws:cloudtrail:arn':
          `arn:${Aws.PARTITION}:cloudtrail:*:` +
          `${Aws.ACCOUNT_ID}:trail/*`,
      },
    },
  }),
);

/*
 * CloudTrail cần đọc thuộc tính KMS Key.
 */

dataKey.addToResourcePolicy(
  new iam.PolicyStatement({
    sid:
      'AllowCloudTrailDescribeKey',

    effect:
      iam.Effect.ALLOW,

    principals: [
      cloudTrailServicePrincipal,
    ],

    actions: [
      'kms:DescribeKey',
    ],

    resources: [
      '*',
    ],

    conditions: {
      StringEquals: {
        'aws:SourceArn':
          trailArn,
      },
    },
  }),
);

/*
 * Do CloudTrail Bucket đang bật bucketKeyEnabled,
 * CloudTrail cần quyền kms:Decrypt.
 */

dataKey.addToResourcePolicy(
  new iam.PolicyStatement({
    sid:
      'AllowCloudTrailDecryptTrail',

    effect:
      iam.Effect.ALLOW,

    principals: [
      cloudTrailServicePrincipal,
    ],

    actions: [
      'kms:Decrypt',
    ],

    resources: [
      '*',
    ],
  }),
);

const trail = new cloudtrail.Trail(
  scope,
  'HospitalAuditTrail',
  {
    trailName,

    bucket:
      trailBucket,

    encryptionKey:
      dataKey,

    enableFileValidation:
      true,

    includeGlobalServiceEvents:
      true,

    isMultiRegionTrail:
      true,

    managementEvents:
      cloudtrail.ReadWriteType.ALL,

    sendToCloudWatchLogs:
      isEnabled(
        'ENABLE_CLOUDTRAIL_CW_LOGS',
        false,
      ),

    cloudWatchLogsRetention:
      logs.RetentionDays.TWO_WEEKS,
  },
);

trail.node.addDependency(
  trailBucket,
);

trail.node.addDependency(
  dataKey,
);
  const backupVault = new backup.BackupVault(
    scope,
    'HospitalBackupVault',
    {
      backupVaultName: 'hospital-p2tb-backup-vault',
      encryptionKey: dataKey,
      removalPolicy: RemovalPolicy.RETAIN,
    },
  );

  const backupPlan = new backup.BackupPlan(
    scope,
    'HospitalBackupPlan',
    {
      backupPlanName: 'hospital-p2tb-daily-backup',
      backupVault,
    },
  );
  backupPlan.applyRemovalPolicy(RemovalPolicy.RETAIN);

  backupPlan.addRule(
    new backup.BackupPlanRule({
      ruleName: 'DailyBackupSevenDayRetention',
      scheduleExpression: events.Schedule.cron({
        minute: '0',
        hour: '18',
      }),
      startWindow: Duration.hours(1),
      completionWindow: Duration.hours(3),
      deleteAfter: Duration.days(7),
    }),
  );

  const backupResources = [
    backup.BackupResource.fromDynamoDbTable(table),
  ];

  if (isEnabled('ENABLE_S3_AWS_BACKUP', false)) {
    backupResources.push(
      backup.BackupResource.fromArn(medicalBucket.bucketArn),
    );
  }

  backupPlan.addSelection('HospitalBackupSelection', {
    backupSelectionName: 'hospital-p2tb-resources',
    resources: backupResources,
    allowRestores: true,
  });

  return {
    opsAlertTopic,
    dashboard,
    trail,
    trailBucket,
    backupVault,
    backupPlan,
  };
}

module.exports = {
  addOperationsResources,
};
