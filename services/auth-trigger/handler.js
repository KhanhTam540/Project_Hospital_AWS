'use strict';

const {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  ScanCommand,
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

function normalizeCitizenId(value, { required = true } = {}) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    if (!required) return null;
    throw new Error('CCCD_REQUIRED: Vui lòng nhập số CCCD');
  }

  if (!/^\d{12}$/.test(normalized)) {
    throw new Error('CCCD_INVALID: CCCD phải gồm đúng 12 chữ số');
  }

  return normalized;
}

function citizenLockKey(citizenId) {
  return {
    pk: `UNIQUE#CCCD#${citizenId}`,
    sk: 'LOCK',
  };
}

function sameOwner(item = {}, userId, patientId) {
  return [
    item.userId,
    item.accountUserId,
    item.cognitoSub,
    item.patientId,
  ]
    .filter(Boolean)
    .some(
      (value) =>
        String(value) === String(userId) ||
        String(value) === String(patientId),
    );
}

async function findLegacyPatientByCitizenId(tableName, citizenId) {
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          '#entityType = :patientType AND (#citizenId = :citizenId OR #cccd = :citizenId)',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
          '#citizenId': 'citizenId',
          '#cccd': 'cccd',
        },
        ExpressionAttributeValues: {
          ':patientType': 'PATIENT',
          ':citizenId': citizenId,
        },
        ProjectionExpression:
          'pk, sk, patientId, accountUserId, cognitoSub, citizenId, cccd',
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    if (response.Items?.length) {
      return response.Items[0];
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return null;
}

async function assertCitizenIdAvailable({
  tableName,
  citizenId,
  userId,
  patientId,
}) {
  const lockResponse = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: citizenLockKey(citizenId),
      ConsistentRead: true,
    }),
  );

  if (
    lockResponse.Item &&
    !sameOwner(lockResponse.Item, userId, patientId)
  ) {
    throw new Error(
      'CCCD_ALREADY_EXISTS: CCCD đã được sử dụng bởi tài khoản khác',
    );
  }

  const legacyPatient = await findLegacyPatientByCitizenId(
    tableName,
    citizenId,
  );

  if (
    legacyPatient &&
    !sameOwner(legacyPatient, userId, patientId)
  ) {
    throw new Error(
      'CCCD_ALREADY_EXISTS: CCCD đã được sử dụng bởi bệnh nhân khác',
    );
  }
}

function buildRecordItems({ citizenId, patientId, now }) {
  const patientSk = `RECORD#${now}#${citizenId}`;
  const baseRecord = {
    entityType: 'RECORD',
    recordId: citizenId,
    medicalRecordId: citizenId,
    recordCode: citizenId,
    citizenId,
    patientId,
    status: 'OPEN',
    dataSource: 'COGNITO_SIGNUP',
    createdBy: 'SYSTEM',
    createdAt: now,
    updatedAt: now,
    version: 1,
    patientSk,
  };

  return {
    directRecord: {
      ...baseRecord,
      pk: `RECORD#${citizenId}`,
      sk: 'METADATA',
    },
    patientRecord: {
      ...baseRecord,
      pk: `PATIENT#${patientId}`,
      sk: patientSk,
    },
  };
}

async function handlePreSignUp(event) {
  const tableName = process.env.TABLE_NAME;
  const triggerSource = String(event?.triggerSource || '');
  const attributes = event?.request?.userAttributes || {};

  // Bắt buộc CCCD đối với luồng bệnh nhân tự đăng ký.
  // Không ép buộc với AdminCreateUser vì quản trị viên còn tạo bác sĩ/nhân sự.
  const required = triggerSource === 'PreSignUp_SignUp';
  const citizenId = normalizeCitizenId(attributes['custom:cccd'], {
    required,
  });

  if (!citizenId) return event;
  if (!tableName) {
    throw new Error('Missing TABLE_NAME environment variable');
  }

  const userId = attributes.sub || event.userName;
  const patientId = buildPatientId(userId);

  if (citizenId) {
    await assertCitizenIdAvailable({
      tableName,
      citizenId,
      userId,
      patientId,
    });
  }

  return event;
}

/**
 * Khởi tạo hồ sơ ứng dụng sau khi người dùng xác nhận email.
 *
 * 1. Thêm tài khoản vào group BENHNHAN.
 * 2. Tạo USER profile.
 * 3. Tạo PATIENT profile có CCCD.
 * 4. Tạo hồ sơ bệnh án với recordId = CCCD.
 * 5. Tạo khóa duy nhất để ngăn hai tài khoản dùng cùng CCCD.
 */
async function handlePostConfirmation(event) {
  const triggerSource = String(event?.triggerSource || '');

  // Không chạy lại khởi tạo bệnh nhân sau thao tác quên mật khẩu.
  if (triggerSource === 'PostConfirmation_ConfirmForgotPassword') {
    return event;
  }

  const userPoolId = event?.userPoolId;
  const username = event?.userName;
  const attributes = event?.request?.userAttributes || {};
  const tableName = process.env.TABLE_NAME;
  const defaultGroup = process.env.DEFAULT_GROUP || 'BENHNHAN';

  if (!userPoolId || !username) {
    throw new Error(
      'Post Confirmation event is missing userPoolId or userName',
    );
  }
  if (!tableName) {
    throw new Error('Missing TABLE_NAME environment variable');
  }

  const userId = attributes.sub || username;
  const patientId = buildPatientId(userId);
  // Tài khoản đăng ký mới luôn có CCCD vì Pre Sign-up đã bắt buộc.
  // required:false giữ khả năng xác nhận các tài khoản chờ xác nhận từ trước khi nâng cấp.
  const citizenId = normalizeCitizenId(attributes['custom:cccd'], {
    required: false,
  });
  const email = String(attributes.email || '').trim().toLowerCase();
  const fullName = String(
    attributes.name || attributes.given_name || email || 'Bệnh nhân',
  ).trim();
  const now = new Date().toISOString();

  if (citizenId) {
    await assertCitizenIdAvailable({
      tableName,
      citizenId,
      userId,
      patientId,
    });
  }

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
    citizenId: defaultGroup === 'BENHNHAN' ? citizenId : null,
    medicalRecordId: defaultGroup === 'BENHNHAN' ? citizenId : null,
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
    citizenId,
    cccd: citizenId,
    medicalRecordId: citizenId,
    recordId: citizenId,
    status: 'ACTIVE',
    dataSource: 'COGNITO',
    createdAt: now,
    updatedAt: now,
  };

  const recordItems = citizenId
    ? buildRecordItems({
        citizenId,
        patientId,
        now,
      })
    : null;

  const lockItem = citizenId
    ? {
        ...citizenLockKey(citizenId),
        entityType: 'UNIQUE_CCCD',
        citizenId,
        userId,
        patientId,
        createdAt: now,
        updatedAt: now,
      }
    : null;

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

    if (citizenId && recordItems && lockItem) {
      transactItems.push(
        {
          Put: {
            TableName: tableName,
            Item: lockItem,
            ConditionExpression:
              'attribute_not_exists(pk) OR #ownerUserId = :ownerUserId OR #ownerPatientId = :ownerPatientId',
            ExpressionAttributeNames: {
              '#ownerUserId': 'userId',
              '#ownerPatientId': 'patientId',
            },
            ExpressionAttributeValues: {
              ':ownerUserId': userId,
              ':ownerPatientId': patientId,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: recordItems.directRecord,
            ConditionExpression:
              'attribute_not_exists(pk) OR #patientId = :patientId',
            ExpressionAttributeNames: {
              '#patientId': 'patientId',
            },
            ExpressionAttributeValues: {
              ':patientId': patientId,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: recordItems.patientRecord,
            ConditionExpression:
              'attribute_not_exists(pk) OR #patientId = :patientId',
            ExpressionAttributeNames: {
              '#patientId': 'patientId',
            },
            ExpressionAttributeValues: {
              ':patientId': patientId,
            },
          },
        },
      );
    }
  }

  try {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );
  } catch (error) {
    if (
      error?.name === 'TransactionCanceledException' ||
      error?.name === 'ConditionalCheckFailedException'
    ) {
      throw new Error(
        'CCCD_ALREADY_EXISTS: CCCD đã được sử dụng bởi tài khoản khác',
      );
    }
    throw error;
  }

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: defaultGroup,
    }),
  );

  console.info('Confirmed Cognito patient initialized successfully', {
    userId,
    patientId: defaultGroup === 'BENHNHAN' ? patientId : null,
    citizenId: defaultGroup === 'BENHNHAN' ? citizenId : null,
    medicalRecordId: defaultGroup === 'BENHNHAN' ? citizenId : null,
    username,
    email,
    group: defaultGroup,
  });

  return event;
}

async function handler(event) {
  const triggerSource = String(event?.triggerSource || '');

  if (triggerSource.startsWith('PreSignUp_')) {
    return handlePreSignUp(event);
  }

  if (triggerSource.startsWith('PostConfirmation_')) {
    return handlePostConfirmation(event);
  }

  return event;
}

module.exports = {
  handler,
  buildPatientId,
  normalizeCitizenId,
  citizenLockKey,
  buildRecordItems,
};
