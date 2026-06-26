'use strict';

const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const {
  DynamoDBClient,
} = require('@aws-sdk/client-dynamodb');

const {
  DynamoDBDocumentClient,
  PutCommand,
} = require('@aws-sdk/lib-dynamodb');

const cognitoClient = new CognitoIdentityProviderClient({});
const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({}),
  {
    marshallOptions: {
      removeUndefinedValues: true,
    },
  },
);

/**
 * Cognito Post Confirmation trigger.
 *
 * Luồng đúng:
 * 1. Người dùng signUp bằng email thật.
 * 2. Cognito gửi mã xác nhận email.
 * 3. Người dùng nhập mã confirmSignUp.
 * 4. Cognito gọi Lambda này.
 * 5. Lambda thêm user vào BENHNHAN và tạo hồ sơ USER trong DynamoDB.
 */
async function handler(event) {
  const userPoolId = event?.userPoolId;
  const username = event?.userName;
  const attributes = event?.request?.userAttributes || {};

  const tableName = process.env.TABLE_NAME;
  const defaultGroup = process.env.DEFAULT_GROUP || 'BENHNHAN';

  if (!userPoolId || !username) {
    throw new Error('Post Confirmation event is missing userPoolId or userName');
  }

  if (!tableName) {
    throw new Error('Missing TABLE_NAME environment variable');
  }

  const userId = attributes.sub || username;
  const email = String(attributes.email || '').trim().toLowerCase();
  const fullName = String(attributes.name || attributes.given_name || '').trim();
  const now = new Date().toISOString();

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: defaultGroup,
    }),
  );

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `USER#${userId}`,
        sk: 'PROFILE',
        entityType: 'USER',
        userId,
        cognitoUsername: username,
        email,
        fullName: fullName || null,
        role: defaultGroup,
        status: 'ACTIVE',
        emailVerified: attributes.email_verified === 'true',
        dataSource: 'COGNITO',
        createdAt: now,
        updatedAt: now,
      },
    }),
  );

  console.info('Confirmed Cognito user initialized successfully', {
    userId,
    username,
    email,
    group: defaultGroup,
  });

  return event;
}

module.exports = { handler };
