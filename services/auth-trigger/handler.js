'use strict';

const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  TransactWriteCommand,
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

function buildPatientId(subject) {
  const suffix = String(subject || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase();

  return `BN-${suffix || Date.now()}`;
}

/**
 * Cognito Post Confirmation trigger.
 *
 * Sau khi người dùng xác nhận email:
 * 1. Thêm tài khoản vào group BENHNHAN.
 * 2. Tạo USER profile trong DynamoDB.
 * 3. Tạo PATIENT profile và liên kết bằng accountUserId/patientId.
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
  const patientId = buildPatientId(userId);
  const email = String(attributes.email || '').trim().toLowerCase();
  const fullName = String(
    attributes.name || attributes.given_name || email || 'Bệnh nhân',
  ).trim();
  const now = new Date().toISOString();

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: defaultGroup,
    }),
  );

  const userItem = {
    pk: `USER#${userId}`,
    sk: 'PROFILE',
    entityType: 'USER',
    userId,
    cognitoSub: attributes.sub || userId,
    cognitoUsername: username,
    email,
    fullName: fullName || null,
    role: defaultGroup,
    patientId: defaultGroup === 'BENHNHAN' ? patientId : null,
    status: 'ACTIVE',
    emailVerified: attributes.email_verified === 'true',
    dataSource: 'COGNITO',
    createdAt: now,
    updatedAt: now,
  };

  const patientItem = {
    pk: `PATIENT#${patientId}`,
    sk: 'PROFILE',
    entityType: 'PATIENT',
    patientId,
    accountUserId: userId,
    cognitoSub: attributes.sub || userId,
    cognitoUsername: username,
    email,
    fullName: fullName || email || 'Bệnh nhân',
    status: 'ACTIVE',
    dataSource: 'COGNITO',
    createdAt: now,
    updatedAt: now,
  };

  const transactItems = [
    {
      Put: {
        TableName: tableName,
        Item: userItem,
      },
    },
  ];

  if (defaultGroup === 'BENHNHAN') {
    transactItems.push({
      Put: {
        TableName: tableName,
        Item: patientItem,
      },
    });
  }

  await documentClient.send(
    new TransactWriteCommand({
      TransactItems: transactItems,
    }),
  );

  console.info('Confirmed Cognito user initialized successfully', {
    userId,
    patientId: defaultGroup === 'BENHNHAN' ? patientId : null,
    username,
    email,
    group: defaultGroup,
  });

  return event;
}

module.exports = { handler, buildPatientId };
