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
const { NodejsFunction } = require('aws-cdk-lib/aws-lambda-nodejs');
const s3 = require('aws-cdk-lib/aws-s3');

class HospitalStack extends Stack {
  constructor(scope, id, props = {}) {
    super(scope, id, props);

    const projectName = 'hospital';
    const environmentName = 'dev';
    const resourcePrefix = `${projectName}-${environmentName}`;
    const enableCloudFront = process.env.ENABLE_CLOUDFRONT !== 'false';
    const retainData = process.env.RETAIN_DATA !== 'false';
    const dataRemovalPolicy = retainData
      ? RemovalPolicy.RETAIN
      : RemovalPolicy.DESTROY;

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

    const createFunction = ({
      id: functionId,
      directory,
      environment = {},
      memorySize = 256,
      timeoutSeconds = 20,
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
      },
    });

    coreFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:ListUsers',
          'cognito-idp:AdminListGroupsForUser',
        ],
        resources: [userPool.userPoolArn],
      }),
    );

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
      '/api/patients',
      [apigwv2.HttpMethod.POST],
      medicalIntegration,
    );
    addProtectedRoute(
      '/api/patients/{patientId}',
      [apigwv2.HttpMethod.GET],
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

      /*
       * The previous CloudFront Function and OAC names exist as orphaned
       * resources in this AWS account. V2 names let CloudFormation create
       * replacements, update the existing distribution, and avoid 409
       * AlreadyExists errors.
       */
      const frontendOriginAccessControl =
        new cloudfront.S3OriginAccessControl(
          this,
          'FrontendOriginAccessControlV2',
          {
            originAccessControlName:
              `${resourcePrefix}-frontend-oac-v2`,
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

      distribution = new cloudfront.Distribution(
        this,
        'HospitalDistribution',
        {
          comment: 'Hospital development frontend and API distribution.',
          defaultRootObject: 'index.html',
          minimumProtocolVersion:
            cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
          priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
          defaultBehavior: {
            origin: origins.S3BucketOrigin.withOriginAccessControl(
              frontendBucket,
              {
                originAccessControl:
                  frontendOriginAccessControl,
              },
            ),
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
      );
    }

    const outputs = {
      Region: this.region,
      FrontendMode: enableCloudFront
        ? 'CLOUDFRONT'
        : 'LOCAL_DEVELOPMENT',
      ApiEndpoint: httpApi.apiEndpoint,
      MedicalBucketName: medicalBucket.bucketName,
      MedicalDataKeyArn: dataKey.keyArn,
      UserPoolId: userPool.userPoolId,
      WebClientId: webClient.userPoolClientId,
      MobileClientId: mobileClient.userPoolClientId,
      TableName: table.tableName,
    };

    if (frontendBucket && distribution) {
      outputs.CloudFrontUrl = `https://${distribution.distributionDomainName}`;
      outputs.CloudFrontDistributionId = distribution.distributionId;
      outputs.FrontendBucketName = frontendBucket.bucketName;
    }

    for (const [outputName, outputValue] of Object.entries(outputs)) {
      new CfnOutput(this, outputName, {
        value: outputValue,
        exportName: `${Aws.STACK_NAME}-${outputName}`,
      });
    }
  }
}

module.exports = { HospitalStack };
