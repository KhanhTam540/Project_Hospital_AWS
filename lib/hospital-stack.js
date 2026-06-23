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

    const dataKey = new kms.Key(this, 'HospitalDataKey', {
      alias: `alias/${projectName}-${environmentName}-data`,
      description: 'Encrypts Hospital development data at rest.',
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
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
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
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
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
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
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const userPool = new cognito.UserPool(this, 'HospitalUserPool', {
      userPoolName: `${projectName}-${environmentName}-users`,
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: true,
        },
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
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const groups = [
      {
        id: 'AdminGroup',
        name: 'ADMIN',
        description: 'Quản trị viên hệ thống.',
        precedence: 0,
      },
      {
        id: 'DoctorGroup',
        name: 'BACSI',
        description: 'Bác sĩ.',
        precedence: 10,
      },
      {
        id: 'StaffGroup',
        name: 'NHANSU',
        description: 'Nhân sự y tế và tiếp đón.',
        precedence: 20,
      },
      {
        id: 'PatientGroup',
        name: 'BENHNHAN',
        description: 'Bệnh nhân.',
        precedence: 30,
      },
    ];

    for (const group of groups) {
      new cognito.CfnUserPoolGroup(this, group.id, {
        userPoolId: userPool.userPoolId,
        groupName: group.name,
        description: group.description,
        precedence: group.precedence,
      });
    }

    const webClient = userPool.addClient('HospitalWebClient', {
      userPoolClientName: `${projectName}-${environmentName}-web`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
    });

    const mobileClient = userPool.addClient('HospitalMobileClient', {
      userPoolClientName: `${projectName}-${environmentName}-mobile`,
      generateSecret: false,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      refreshTokenValidity: Duration.days(30),
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

    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationFunction,
    );

    const coreFunction = createFunction({
      id: 'CoreFunction',
      directory: 'core',
    });

    const medicalFunction = createFunction({
      id: 'MedicalFunction',
      directory: 'medical',
      environment: {
        TABLE_NAME: table.tableName,
        MEDICAL_BUCKET_NAME: medicalBucket.bucketName,
        MAX_FILE_SIZE_BYTES: String(10 * 1024 * 1024),
      },
      memorySize: 512,
      timeoutSeconds: 30,
    });

    table.grantReadWriteData(medicalFunction);
    medicalBucket.grantReadWrite(medicalFunction);

    const httpApi = new apigwv2.HttpApi(this, 'HospitalHttpApi', {
      apiName: `${projectName}-${environmentName}-api`,
      corsPreflight: {
        allowHeaders: ['authorization', 'content-type'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ],
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

    addProtectedRoute(
      '/api/me',
      [apigwv2.HttpMethod.GET],
      coreIntegration,
    );
    addProtectedRoute(
      '/api/admin/ping',
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

    const spaRewrite = new cloudfront.Function(this, 'SpaRewriteFunction', {
      functionName: `${projectName}-${environmentName}-spa-rewrite`,
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
    });

    const distribution = new cloudfront.Distribution(
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
          ),
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
            origin: new origins.HttpOrigin(
              `${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`,
              {
                protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
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

    const outputs = {
      Region: this.region,
      CloudFrontUrl: `https://${distribution.distributionDomainName}`,
      CloudFrontDistributionId: distribution.distributionId,
      ApiEndpoint: httpApi.apiEndpoint,
      FrontendBucketName: frontendBucket.bucketName,
      MedicalBucketName: medicalBucket.bucketName,
      UserPoolId: userPool.userPoolId,
      WebClientId: webClient.userPoolClientId,
      MobileClientId: mobileClient.userPoolClientId,
      TableName: table.tableName,
    };

    for (const [outputName, outputValue] of Object.entries(outputs)) {
      new CfnOutput(this, outputName, {
        value: outputValue,
        exportName: `${Aws.STACK_NAME}-${outputName}`,
      });
    }
  }
}

module.exports = { HospitalStack };
