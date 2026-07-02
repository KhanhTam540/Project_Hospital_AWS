'use strict';

const path = require('path');

const {
  Aws,
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
} = require('aws-cdk-lib');

const apigwv2 = require('aws-cdk-lib/aws-apigatewayv2');
const {
  HttpJwtAuthorizer,
} = require('aws-cdk-lib/aws-apigatewayv2-authorizers');
const {
  HttpLambdaIntegration,
} = require('aws-cdk-lib/aws-apigatewayv2-integrations');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');
const cognito = require('aws-cdk-lib/aws-cognito');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const iam = require('aws-cdk-lib/aws-iam');
const kms = require('aws-cdk-lib/aws-kms');
const lambda = require('aws-cdk-lib/aws-lambda');
const {
  NodejsFunction,
} = require('aws-cdk-lib/aws-lambda-nodejs');
const logs = require('aws-cdk-lib/aws-logs');
const s3 = require('aws-cdk-lib/aws-s3');
const secretsmanager = require('aws-cdk-lib/aws-secretsmanager');
const sns = require('aws-cdk-lib/aws-sns');
const sqs = require('aws-cdk-lib/aws-sqs');

const {
  addOperationsResources,
} = require('./operations-resources');

function envFlag(name, defaultValue = true) {
  const value = process.env[name];

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).trim().toLowerCase() === 'true';
}

class HospitalStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    const projectName = 'hospital';
    const environmentName = 'dev';
    const resourcePrefix = `${projectName}-${environmentName}`;

    const enableCloudFront = envFlag('ENABLE_CLOUDFRONT', true);
    const retainData = envFlag('RETAIN_DATA', true);
    const enableWeek3Operations = envFlag(
      'ENABLE_WEEK3_OPERATIONS',
      true,
    );
    const enableManagedBlockchainPermissions = envFlag(
      'ENABLE_MANAGED_BLOCKCHAIN_PERMISSIONS',
      true,
    );

    const dataRemovalPolicy = retainData
      ? RemovalPolicy.RETAIN
      : RemovalPolicy.DESTROY;

    const edgeSecurity = props.edgeSecurity || { enabled: false };
    const edgeSecurityEnabled = edgeSecurity.enabled === true;
    const cloudFrontWebAclArn = String(
      edgeSecurity.webAclArn || '',
    ).trim();

    if (
      enableCloudFront &&
      edgeSecurityEnabled &&
      !cloudFrontWebAclArn
    ) {
      throw new Error(
        'CloudFront Free plan requires the existing CLOUDFRONT_WEB_ACL_ARN.',
      );
    }

    /* =========================================================
     * WEEK 1-2: KMS, S3 MEDICAL, DYNAMODB
     * =======================================================*/

    const dataKey = new kms.Key(this, 'HospitalDataKey', {
      alias: `alias/${resourcePrefix}-data`,
      description: 'Encrypts Hospital development data at rest.',
      enableKeyRotation: true,
      removalPolicy: dataRemovalPolicy,
    });

    const medicalBucket = new s3.Bucket(this, 'MedicalBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: dataKey,
      bucketKeyEnabled: true,
      enforceSSL: true,
      versioned: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'AbortIncompleteMultipartUploads',
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      removalPolicy: dataRemovalPolicy,
      autoDeleteObjects: !retainData,
    });

    const table = new dynamodb.Table(this, 'HospitalTable', {
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: dataKey,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
        recoveryPeriodInDays: 35,
      },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: dataRemovalPolicy,
    });

    /* =========================================================
     * WEEK 2: SECRETS MANAGER, SQS, SNS
     * =======================================================*/

    const integrationSecret = new secretsmanager.Secret(
      this,
      'HospitalIntegrationSecret',
      {
        description:
          'Generated integration secret for Hospital P2TB external services and external ChatAI.',
        encryptionKey: dataKey,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            VNPAY_TMN_CODE: 'SET_IN_AWS_CONSOLE',
            MOMO_PARTNER_CODE: 'SET_IN_AWS_CONSOLE',
            AI_PROVIDER: 'openai-compatible',
            AI_BASE_URL: 'SET_IN_AWS_CONSOLE',
            AI_API_STYLE: 'chat-completions',
            AI_MODEL: 'SET_IN_AWS_CONSOLE',
            AI_API_KEY: 'SET_IN_AWS_CONSOLE',
            AI_TIMEOUT_MS: '20000',
            AI_MAX_OUTPUT_TOKENS: '600',
            AI_AUTH_HEADER: 'Authorization',
            AI_AUTH_SCHEME: 'Bearer',
            AI_EXTRA_HEADERS_JSON: '{}',
            BLOCKCHAIN_NETWORK_ID: 'SET_IN_AWS_CONSOLE',
          }),
          generateStringKey: 'INTERNAL_SIGNING_KEY',
          passwordLength: 40,
          excludePunctuation: true,
        },
        removalPolicy: dataRemovalPolicy,
      },
    );

    const backgroundTaskDlq = new sqs.Queue(
      this,
      'BackgroundTaskDlq',
      {
        encryption: sqs.QueueEncryption.KMS,
        encryptionMasterKey: dataKey,
        enforceSSL: true,
        retentionPeriod: Duration.days(14),
        removalPolicy: dataRemovalPolicy,
      },
    );

    const backgroundTaskQueue = new sqs.Queue(
      this,
      'BackgroundTaskQueue',
      {
        encryption: sqs.QueueEncryption.KMS,
        encryptionMasterKey: dataKey,
        enforceSSL: true,
        visibilityTimeout: Duration.minutes(2),
        retentionPeriod: Duration.days(4),
        receiveMessageWaitTime: Duration.seconds(20),
        deadLetterQueue: {
          queue: backgroundTaskDlq,
          maxReceiveCount: 5,
        },
        removalPolicy: dataRemovalPolicy,
      },
    );

    const otpTopic = new sns.Topic(this, 'HospitalOtpTopic', {
      displayName: 'Hospital P2TB OTP',
      masterKey: dataKey,
      enforceSSL: true,
    });
    otpTopic.applyRemovalPolicy(dataRemovalPolicy);

    /* =========================================================
     * WEEK 1: COGNITO
     * =======================================================*/

    const userPool = new cognito.UserPool(this, 'HospitalUserPool', {
      userPoolName: `${resourcePrefix}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        phoneNumber: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: dataRemovalPolicy,
    });

    const groups = [
      ['AdminGroup', 'ADMIN', 'Quản trị viên hệ thống.', 0],
      ['DoctorGroup', 'BACSI', 'Bác sĩ.', 10],
      ['StaffGroup', 'NHANSU', 'Nhân sự y tế và tiếp đón.', 20],
      ['PatientGroup', 'BENHNHAN', 'Bệnh nhân.', 30],
    ];

    for (const [groupId, groupName, description, precedence] of groups) {
      new cognito.CfnUserPoolGroup(this, groupId, {
        userPoolId: userPool.userPoolId,
        groupName,
        description,
        precedence,
      });
    }

    const commonClientOptions = {
      generateSecret: false,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
    };

    const webClient = userPool.addClient('HospitalWebClient', {
      ...commonClientOptions,
      userPoolClientName: `${resourcePrefix}-web`,
    });

    const mobileClient = userPool.addClient('HospitalMobileClient', {
      ...commonClientOptions,
      userPoolClientName: `${resourcePrefix}-mobile`,
    });

    /* =========================================================
     * LAMBDA FACTORY
     * =======================================================*/

    const createFunction = ({
      id: functionId,
      directory,
      environment = {},
      memorySize = 256,
      timeoutSeconds = 20,
      role,
    }) =>
      new NodejsFunction(this, functionId, {
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.X86_64,
        entry: path.join(
          __dirname,
          '..',
          'services',
          directory,
          'handler.js',
        ),
        handler: 'handler',
        memorySize,
        timeout: Duration.seconds(timeoutSeconds),
        tracing: lambda.Tracing.ACTIVE,
        role,
        logRetention: logs.RetentionDays.TWO_WEEKS,
        environment: {
          LOG_LEVEL: 'INFO',
          PROJECT_NAME: 'Hospital_P2TB',
          ...environment,
        },
        bundling: {
          minify: true,
          sourceMap: true,
          target: 'node22',
        },
      });

    const postConfirmationFunction = createFunction({
      id: 'PostConfirmationFunction',
      directory: 'auth-trigger',
      environment: {
        DEFAULT_GROUP: 'BENHNHAN',
        TABLE_NAME: table.tableName,
      },
      memorySize: 128,
      timeoutSeconds: 10,
    });

    postConfirmationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: [
          Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: '*',
          }),
        ],
      }),
    );
    table.grantWriteData(postConfirmationFunction);
    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationFunction,
    );

    const coreFunction = createFunction({
      id: 'CoreFunction',
      directory: 'core',
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        TABLE_NAME: table.tableName,
      },
    });

    coreFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminRemoveUserFromGroup',
          'cognito-idp:AdminDisableUser',
        ],
        resources: [userPool.userPoolArn],
      }),
    );
    table.grantReadWriteData(coreFunction);

    const medicalFunction = createFunction({
      id: 'MedicalFunction',
      directory: 'medical',
      environment: {
        TABLE_NAME: table.tableName,
        MEDICAL_BUCKET_NAME: medicalBucket.bucketName,
        MAX_FILE_SIZE_BYTES: String(10 * 1024 * 1024),
        PRESIGNED_URL_TTL_SECONDS: '300',
      },
      memorySize: 512,
      timeoutSeconds: 30,
    });
    table.grantReadWriteData(medicalFunction);
    medicalBucket.grantReadWrite(medicalFunction);

    /* =========================================================
     * EXTERNAL CHAT AI ROLE AND LAMBDA
     * =======================================================*/

    const aiAuditRole = new iam.Role(this, 'AiAuditExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description:
        'Execution role for Hospital P2TB external ChatAI and audit Lambda.',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AWSXRayDaemonWriteAccess',
        ),
      ],
    });

    if (enableManagedBlockchainPermissions) {
      aiAuditRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            'managedblockchain:ListNetworks',
            'managedblockchain:GetNetwork',
            'managedblockchain:ListMembers',
            'managedblockchain:GetMember',
            'managedblockchain:ListNodes',
            'managedblockchain:GetNode',
          ],
          resources: ['*'],
        }),
      );

      aiAuditRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            'managedblockchain-query:GetTransaction',
            'managedblockchain-query:ListTransactions',
            'managedblockchain-query:ListTransactionEvents',
            'managedblockchain-query:ListFilteredTransactionEvents',
          ],
          resources: ['*'],
        }),
      );
    }

    integrationSecret.grantRead(aiAuditRole);
    table.grantWriteData(aiAuditRole);

    const aiAuditFunction = createFunction({
      id: 'AiAuditFunction',
      directory: 'ai-audit',
      role: aiAuditRole,
      environment: {
        TABLE_NAME: table.tableName,
        INTEGRATION_SECRET_ARN: integrationSecret.secretArn,
        AI_AUDIT_RETENTION_DAYS: '90',
        AI_ALLOWED_GROUPS: 'ADMIN,BACSI,NHANSU,BENHNHAN',
      },
      memorySize: 512,
      timeoutSeconds: 30,
    });

    /* =========================================================
     * PERMISSIONS AND ENVIRONMENT
     * =======================================================*/

    backgroundTaskQueue.grantSendMessages(coreFunction);
    backgroundTaskQueue.grantSendMessages(medicalFunction);
    otpTopic.grantPublish(coreFunction);
    integrationSecret.grantRead(coreFunction);

    coreFunction.addEnvironment(
      'BACKGROUND_QUEUE_URL',
      backgroundTaskQueue.queueUrl,
    );
    coreFunction.addEnvironment('OTP_TOPIC_ARN', otpTopic.topicArn);
    coreFunction.addEnvironment(
      'INTEGRATION_SECRET_ARN',
      integrationSecret.secretArn,
    );
    medicalFunction.addEnvironment(
      'BACKGROUND_QUEUE_URL',
      backgroundTaskQueue.queueUrl,
    );

    /* =========================================================
     * API GATEWAY
     * =======================================================*/

    const httpApi = new apigwv2.HttpApi(this, 'HospitalHttpApi', {
      apiName: `${resourcePrefix}-api`,
      corsPreflight: {
        allowHeaders: [
          'authorization',
          'content-type',
          'x-amz-meta-documentid',
          'x-amz-meta-patientid',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
        maxAge: Duration.hours(1),
      },
    });

    const jwtAuthorizer = new HttpJwtAuthorizer(
      'CognitoJwtAuthorizer',
      `https://cognito-idp.${this.region}.${this.urlSuffix}/${userPool.userPoolId}`,
      {
        jwtAudience: [
          webClient.userPoolClientId,
          mobileClient.userPoolClientId,
        ],
      },
    );

    const coreIntegration = new HttpLambdaIntegration(
      'CoreIntegration',
      coreFunction,
    );
    const medicalIntegration = new HttpLambdaIntegration(
      'MedicalIntegration',
      medicalFunction,
    );
    const aiAuditIntegration = new HttpLambdaIntegration(
      'AiAuditIntegration',
      aiAuditFunction,
    );

    const addProtectedRoute = (routePath, methods, integration) =>
      httpApi.addRoutes({
        path: routePath,
        methods,
        integration,
        authorizer: jwtAuthorizer,
      });

    httpApi.addRoutes({
      path: '/api/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: coreIntegration,
    });

    addProtectedRoute('/api/me', [apigwv2.HttpMethod.GET], coreIntegration);
    addProtectedRoute('/api/auth/me', [apigwv2.HttpMethod.GET], coreIntegration);
    addProtectedRoute(
      '/api/admin/ping',
      [apigwv2.HttpMethod.GET],
      coreIntegration,
    );
    addProtectedRoute(
      '/api/auth/me',
      [apigwv2.HttpMethod.GET],
      coreIntegration,
    );
    addProtectedRoute(
      '/api/admin/ping',
      [apigwv2.HttpMethod.GET],
      coreIntegration,
    );
    addProtectedRoute(
      '/api/tai-khoan',
      [apigwv2.HttpMethod.GET],
      coreIntegration,
    );
    addProtectedRoute(
      '/api/tai-khoan/{username}',
      [apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE],
      coreIntegration,
    );

    addProtectedRoute(
      '/api/patients',
      [apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}',
      [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}/records',
      [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}/examinations',
      [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}/prescriptions',
      [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}/documents',
      [apigwv2.HttpMethod.GET],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/medical/upload-url',
      [apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/medical/complete-upload',
      [apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/medical/download-url',
      [apigwv2.HttpMethod.GET],
      medicalIntegration,
    );

    addProtectedRoute(
      '/api/ai/chat',
      [apigwv2.HttpMethod.POST],
      aiAuditIntegration,
    );
    addProtectedRoute(
      '/api/ai/summary',
      [apigwv2.HttpMethod.POST],
      aiAuditIntegration,
    );

    const compatibilityReadRoutes = [
      '/api/benhnhan',
      '/api/benhnhan/{patientId}',
      '/api/benhnhan/findByMaTK/{maTK}',
      '/api/bacsi',
      '/api/bacsi/maTK/{maTK}',
      '/api/bacsi/tk/{maTK}',
      '/api/nhansu',
      '/api/nhansu/maTK/{maTK}',
      '/api/khoa',
      '/api/phongkham',
      '/api/lichkham',
      '/api/lichkham/benhnhan/{patientId}',
      '/api/lichkham/bacsi/{doctorId}',
      '/api/hsba',
      '/api/hsba/benhnhan/{patientId}',
      '/api/phieukham',
      '/api/phieukham/nurse/queue',
      '/api/donthuoc',
      '/api/thuoc',
      '/api/thuoc/donvitinh',
      '/api/thuoc/nhomthuoc',
      '/api/lichlamviec',
      '/api/lichlamviec/bacsi/{doctorId}',
      '/api/lichlamviec/nhansu/{staffId}',
      '/api/catruc',
      '/api/hoadon',
      '/api/hoadon/thongke',
      '/api/xetnghiem',
      '/api/yeucauxetnghiem',
      '/api/phieuxetnghiem',
    ];

    for (const routePath of compatibilityReadRoutes) {
      addProtectedRoute(
        routePath,
        [apigwv2.HttpMethod.GET],
        medicalIntegration,
      );
    }

    addProtectedRoute(
      '/api/benhnhan/{patientId}',
      [apigwv2.HttpMethod.PUT],
      medicalIntegration,
    );

    /* =========================================================
     * WEEK 1: CLOUDFRONT FREE PLAN + PRIVATE S3 OAC
     * =======================================================*/

    let frontendBucket;
    let distribution;

    if (enableCloudFront) {
      frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,
        versioned: true,
        removalPolicy: dataRemovalPolicy,
        autoDeleteObjects: !retainData,
      });

      const frontendOriginAccessControl =
        new cloudfront.S3OriginAccessControl(
          this,
          'FrontendOriginAccessControlV2',
          {
            originAccessControlName: `${resourcePrefix}-frontend-oac-v2`,
            description:
              'Hospital P2TB private S3 frontend access control.',
          },
        );

      const spaRewrite = new cloudfront.Function(
        this,
        'SpaRewriteFunctionV2',
        {
          functionName: `${resourcePrefix}-spa-rewrite-v2`,
          code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
          `),
        },
      );

      const frontendOrigin = origins.S3BucketOrigin.withOriginAccessControl(
        frontendBucket,
        {
          originAccessControl: frontendOriginAccessControl,
        },
      );

      const apiOrigin = new origins.HttpOrigin(
        `${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`,
        {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
        },
      );

      const distributionProps = {
        comment: 'Hospital development frontend and API distribution.',
        defaultRootObject: 'index.html',
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        enableIpv6: true,
        defaultBehavior: {
          origin: frontendOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy:
            cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
          compress: true,
          functionAssociations: [
            {
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              function: spaRewrite,
            },
          ],
        },
        additionalBehaviors: {
          'api/*': {
            origin: apiOrigin,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods:
              cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            responseHeadersPolicy:
              cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
            compress: true,
            functionAssociations: [
              {
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
                function: spaRewrite,
              },
            ],
          },
          additionalBehaviors: {
            'api/*': {
              origin: new origins.HttpOrigin(
                `${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`,
                {
                  protocolPolicy:
                    cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
                  originSslProtocols: [cloudfront.OriginSslPolicy.TLS_V1_2],
                },
              ),
              viewerProtocolPolicy:
                cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
              cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
              originRequestPolicy:
                cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
              responseHeadersPolicy:
                cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
              compress: true,
            },
          },
        },
      };

      // CloudFront Free plan: không cấu hình priceClass, custom domain hoặc ACM.
      if (edgeSecurityEnabled && cloudFrontWebAclArn) {
        distributionProps.webAclId = cloudFrontWebAclArn;
      }

      distribution = new cloudfront.Distribution(
        this,
        'HospitalDistribution',
        distributionProps,
      );
    }

    /* =========================================================
     * WEEK 3: CLOUDWATCH, CLOUDTRAIL, AWS BACKUP
     * =======================================================*/

    let operations;

    if (enableWeek3Operations) {
      operations = addOperationsResources(this, {
        dataKey,
        table,
        medicalBucket,
        coreFunction,
        medicalFunction,
        aiAuditFunction,
        httpApi,
        backgroundTaskQueue,
        backgroundTaskDlq,
        retainData,
      });
    }

    /* =========================================================
     * OUTPUTS
     * =======================================================*/

    const outputs = {
      Region: this.region,
      FrontendMode: enableCloudFront
        ? 'CLOUDFRONT_FREE_PLAN'
        : 'LOCAL_DEVELOPMENT',
      ApiEndpoint: httpApi.apiEndpoint,
      MedicalBucketName: medicalBucket.bucketName,
      MedicalDataKeyArn: dataKey.keyArn,
      UserPoolId: userPool.userPoolId,
      WebClientId: webClient.userPoolClientId,
      MobileClientId: mobileClient.userPoolClientId,
      TableName: table.tableName,
      IntegrationSecretArn: integrationSecret.secretArn,
      IntegrationSecretName: integrationSecret.secretName,
      BackgroundQueueUrl: backgroundTaskQueue.queueUrl,
      BackgroundQueueArn: backgroundTaskQueue.queueArn,
      BackgroundDlqUrl: backgroundTaskDlq.queueUrl,
      BackgroundDlqArn: backgroundTaskDlq.queueArn,
      OtpTopicArn: otpTopic.topicArn,
      AiAuditRoleArn: aiAuditRole.roleArn,
      AiFunctionName: aiAuditFunction.functionName,
      AiProviderMode: 'EXTERNAL_OPENAI_COMPATIBLE',
      CloudFrontDomainMode: 'DEFAULT_CLOUDFRONT_NET',
      CloudFrontWafEnabled: edgeSecurityEnabled ? 'true' : 'false',
    };

    if (edgeSecurityEnabled && cloudFrontWebAclArn) {
      outputs.CloudFrontWebAclArn = cloudFrontWebAclArn;
    }

    if (frontendBucket && distribution) {
      outputs.CloudFrontUrl =
        `https://${distribution.distributionDomainName}`;
      outputs.CloudFrontDistributionId = distribution.distributionId;
      outputs.FrontendBucketName = frontendBucket.bucketName;
    }

    if (operations) {
      outputs.OpsAlertTopicArn = operations.opsAlertTopic.topicArn;
      outputs.OperationsDashboardName = operations.dashboard.dashboardName;
      outputs.CloudTrailArn = operations.trail.trailArn;
      outputs.CloudTrailBucketName = operations.trailBucket.bucketName;
      outputs.BackupPlanId = operations.backupPlan.backupPlanId;
      outputs.BackupVaultName = operations.backupVault.backupVaultName;
    }

    for (const [outputName, outputValue] of Object.entries(outputs)) {
      new CfnOutput(this, outputName, {
        value: outputValue,
        exportName: `${Aws.STACK_NAME}-${outputName}`,
      });
    }
  }
}

module.exports = {
  HospitalStack,
};
