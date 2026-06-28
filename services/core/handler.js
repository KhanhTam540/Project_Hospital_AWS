'use strict';

const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminDisableUserCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const {
  ScanCommand,
  PutCommand,
  UpdateCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  success,
  failure,
  getRouteKey,
  parseJsonBody,
  routeParameter,
} = require('../shared/http');
const {
  AuthError,
  SYSTEM_GROUPS,
  getCurrentUser,
  requireAuthenticated,
  requireGroups,
} = require('../shared/auth');
const { ValidationError } = require('../shared/validation');
const { documentClient } = require('../shared/dynamodb');

const PROJECT_NAME = 'Hospital_P2TB';
const cognitoClient = new CognitoIdentityProviderClient({});

const DEMO_LINKS = Object.freeze({
  'admin.demo@example.com': { appUserId: 'USER001' },
  'admin.p2tb@example.com': { appUserId: 'USER001' },
  'doctor.demo@example.com': {
    appUserId: 'USER002',
    doctorId: 'BS001',
  },
  'doctor.p2tb@example.com': {
    appUserId: 'USER002',
    doctorId: 'BS001',
  },
  'staff.demo@example.com': {
    appUserId: 'USER003',
    staffId: 'NS001',
    staffType: 'TN',
  },
  'staff.p2tb@example.com': {
    appUserId: 'USER003',
    staffId: 'NS001',
    staffType: 'TN',
  },
  'patient.demo@example.com': {
    appUserId: 'USER004',
    patientId: 'BN001',
  },
  'patient.p2tb@example.com': {
    appUserId: 'USER004',
    patientId: 'BN001',
  },
});

function requireEnvironment() {
  const userPoolId = process.env.USER_POOL_ID;
  const tableName = process.env.TABLE_NAME;

  if (!userPoolId) {
    throw new Error('Missing USER_POOL_ID environment variable');
  }
  if (!tableName) {
    throw new Error('Missing TABLE_NAME environment variable');
  }

  return { userPoolId, tableName };
}

function convertAttributes(attributes = []) {
  return Object.fromEntries(
    attributes.map((attribute) => [attribute.Name, attribute.Value]),
  );
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function primaryRole(groups = []) {
  return (
    SYSTEM_GROUPS.find((group) => groups.includes(group)) || null
  );
}

function buildGeneratedPatientId(subject) {
  const suffix = String(subject || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase();
  return `BN-${suffix || Date.now()}`;
}

async function getUserGroups(username) {
  const { userPoolId } = requireEnvironment();
  const response = await cognitoClient.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );

  return (response.Groups || [])
    .map((group) => group.GroupName)
    .filter(Boolean);
}

async function getCognitoUser(username) {
  const { userPoolId } = requireEnvironment();
  const response = await cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );

  return {
    username: response.Username || username,
    enabled: response.Enabled !== false,
    status: response.UserStatus || null,
    attributes: convertAttributes(response.UserAttributes),
  };
}

async function scanApplicationUsers() {
  const { tableName } = requireEnvironment();
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await documentClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: exclusiveStartKey,
        FilterExpression: '#entityType = :entityType',
        ExpressionAttributeNames: {
          '#entityType': 'entityType',
        },
        ExpressionAttributeValues: {
          ':entityType': 'USER',
        },
      }),
    );

    items.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
}

function findApplicationUser(items, identity = {}) {
  const email = normalizeEmail(identity.email);
  const subject = String(identity.sub || '').trim();
  const username = String(identity.username || '').trim();
  const demoLink = DEMO_LINKS[email] || {};

  return (
    items.find((item) => demoLink.appUserId && item.userId === demoLink.appUserId) ||
    items.find((item) => subject && (
      item.cognitoSub === subject ||
      item.userId === subject
    )) ||
    items.find((item) => username && item.cognitoUsername === username) ||
    items.find((item) => email && normalizeEmail(item.email) === email) ||
    null
  );
}

async function ensurePatientProfile({
  appUser,
  subject,
  username,
  email,
  fullName,
}) {
  const { tableName } = requireEnvironment();
  const demoLink = DEMO_LINKS[normalizeEmail(email)] || {};
  const patientId =
    appUser?.patientId ||
    demoLink.patientId ||
    buildGeneratedPatientId(subject);
  const appUserId = appUser?.userId || demoLink.appUserId || subject;
  const now = new Date().toISOString();

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `PATIENT#${patientId}`,
        sk: 'PROFILE',
        entityType: 'PATIENT',
        patientId,
        accountUserId: appUserId,
        cognitoSub: subject,
        cognitoUsername: username,
        email: normalizeEmail(email) || null,
        fullName: fullName || email || 'Bệnh nhân',
        status: 'ACTIVE',
        dataSource: appUser ? appUser.dataSource || 'COGNITO' : 'COGNITO',
        createdAt: appUser?.createdAt || now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
    }),
  ).catch((error) => {
    if (error?.name !== 'ConditionalCheckFailedException') throw error;
  });

  return patientId;
}

async function ensureApplicationProfile(event) {
  const current = requireAuthenticated(event);
  const cognitoUser = await getCognitoUser(current.username);
  const attributes = cognitoUser.attributes;
  const email = normalizeEmail(attributes.email || current.email);
  const subject = attributes.sub || current.sub;
  const username = cognitoUser.username || current.username;
  const groups = current.groups.length
    ? current.groups
    : await getUserGroups(username);
  const role = primaryRole(groups);
  const profiles = await scanApplicationUsers();
  let appUser = findApplicationUser(profiles, {
    sub: subject,
    username,
    email,
  });
  const demoLink = DEMO_LINKS[email] || {};
  const now = new Date().toISOString();
  const appUserId = appUser?.userId || demoLink.appUserId || subject;
  const fullName =
    attributes.name ||
    attributes.given_name ||
    appUser?.fullName ||
    email ||
    username;

  let patientId = appUser?.patientId || demoLink.patientId;
  const doctorId = appUser?.doctorId || demoLink.doctorId;
  const staffId = appUser?.staffId || demoLink.staffId;
  const staffType = appUser?.staffType || demoLink.staffType || '';

  if (role === 'BENHNHAN' && !patientId) {
    patientId = await ensurePatientProfile({
      appUser,
      subject,
      username,
      email,
      fullName,
    });
  }

  const item = {
    pk: `USER#${appUserId}`,
    sk: 'PROFILE',
    entityType: 'USER',
    userId: appUserId,
    cognitoSub: subject,
    cognitoUsername: username,
    email: email || null,
    fullName: fullName || null,
    role,
    patientId: patientId || null,
    doctorId: doctorId || null,
    staffId: staffId || null,
    staffType: staffType || null,
    status: cognitoUser.enabled ? 'ACTIVE' : 'DISABLED',
    emailVerified: attributes.email_verified === 'true',
    dataSource: appUser?.dataSource || 'COGNITO',
    createdAt: appUser?.createdAt || now,
    updatedAt: now,
  };

  const { tableName } = requireEnvironment();
  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: item,
    }),
  );

  if (role === 'BENHNHAN') {
    await ensurePatientProfile({
      appUser: item,
      subject,
      username,
      email,
      fullName,
    });
  }

  return {
    current,
    cognitoUser,
    attributes,
    groups,
    role,
    appUser: item,
  };
}

async function handleHealth() {
  return success({
    service: 'hospital-p2tb-core-api',
    status: 'ok',
    project: PROJECT_NAME,
    timestamp: new Date().toISOString(),
  });
}

async function handleMe(event) {
  const fallbackUser = requireAuthenticated(event);

  // Cho phép unit test và local handler test chạy không cần gọi AWS.
  // Trên Lambda thật, USER_POOL_ID và TABLE_NAME luôn được CDK truyền vào.
  if (!process.env.USER_POOL_ID || !process.env.TABLE_NAME) {
    return success({
      sub: fallbackUser.sub,
      username: fallbackUser.username,
      email: fallbackUser.email,
      groups: fallbackUser.groups,
      primaryRole: fallbackUser.primaryRole,
      maNhom: fallbackUser.primaryRole,
      maTK: fallbackUser.sub,
      appUserId: fallbackUser.sub,
      maBN: fallbackUser.primaryRole === 'BENHNHAN' ? fallbackUser.sub : null,
      patientId: fallbackUser.primaryRole === 'BENHNHAN' ? fallbackUser.sub : null,
      maBS: fallbackUser.primaryRole === 'BACSI' ? fallbackUser.sub : null,
      doctorId: fallbackUser.primaryRole === 'BACSI' ? fallbackUser.sub : null,
      maNS: fallbackUser.primaryRole === 'NHANSU' ? fallbackUser.sub : null,
      staffId: fallbackUser.primaryRole === 'NHANSU' ? fallbackUser.sub : null,
    });
  }

  const profile = await ensureApplicationProfile(event);
  const { appUser, attributes, groups, role, current } = profile;

  return success({
    sub: current.sub,
    username: profile.cognitoUser.username,
    email: attributes.email || appUser.email || null,
    groups,
    primaryRole: role,
    maNhom: role,
    maTK: appUser.userId,
    appUserId: appUser.userId,
    maBN: appUser.patientId || null,
    patientId: appUser.patientId || null,
    maBS: appUser.doctorId || null,
    doctorId: appUser.doctorId || null,
    maNS: appUser.staffId || null,
    staffId: appUser.staffId || null,
    loaiNS: appUser.staffType || null,
    hoTen: appUser.fullName || null,
    fullName: appUser.fullName || null,
  });
}

async function handleAdminPing(event) {
  const user = requireGroups(event, ['ADMIN']);
  return success({
    message: 'Admin access granted',
    actor: {
      sub: user.sub,
      username: user.username,
      groups: user.groups,
    },
  });
}

async function handleListAccounts(event) {
  requireGroups(event, ['ADMIN']);
  const { userPoolId } = requireEnvironment();
  const profiles = await scanApplicationUsers();
  const cognitoUsers = [];
  let paginationToken;

  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: 60,
        PaginationToken: paginationToken,
      }),
    );
    cognitoUsers.push(...(response.Users || []));
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  const users = await Promise.all(
    cognitoUsers.map(async (user) => {
      const attributes = convertAttributes(user.Attributes);
      let groups = [];

      try {
        groups = await getUserGroups(user.Username);
      } catch (error) {
        console.error('Cannot load user groups', {
          username: user.Username,
          message: error.message,
        });
      }

      const appUser = findApplicationUser(profiles, {
        sub: attributes.sub,
        username: user.Username,
        email: attributes.email,
      });
      const role = primaryRole(groups);

      return {
        id: attributes.sub || user.Username,
        username: user.Username,
        email: attributes.email || null,
        emailVerified: attributes.email_verified === 'true',
        phoneNumber: attributes.phone_number || null,
        enabled: user.Enabled === true,
        confirmationStatus: user.UserStatus || null,
        groups,
        primaryRole: role,
        maNhom: role,
        maTK: appUser?.userId || attributes.sub || user.Username,
        maBN: appUser?.patientId || null,
        maBS: appUser?.doctorId || null,
        maNS: appUser?.staffId || null,
        loaiNS: appUser?.staffType || null,
        hoTen: appUser?.fullName || attributes.name || attributes.email || user.Username,
        createdAt: user.UserCreateDate?.toISOString() || null,
        updatedAt: user.UserLastModifiedDate?.toISOString() || null,
      };
    }),
  );

  users.sort((first, second) =>
    String(first.email || first.username).localeCompare(
      String(second.email || second.username),
    ),
  );

  return success({
    users,
    total: users.length,
    summary: {
      admin: users.filter((user) => user.groups.includes('ADMIN')).length,
      doctor: users.filter((user) => user.groups.includes('BACSI')).length,
      staff: users.filter((user) => user.groups.includes('NHANSU')).length,
      patient: users.filter((user) => user.groups.includes('BENHNHAN')).length,
      unconfirmed: users.filter(
        (user) => user.confirmationStatus === 'UNCONFIRMED',
      ).length,
    },
  });
}

async function handleUpdateAccountRole(event) {
  requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');
  const body = parseJsonBody(event);
  const requestedRole = String(body.maNhom || body.role || '')
    .trim()
    .toUpperCase();

  if (!SYSTEM_GROUPS.includes(requestedRole)) {
    throw new ValidationError(
      `Vai trò phải là một trong: ${SYSTEM_GROUPS.join(', ')}`,
    );
  }

  const { userPoolId, tableName } = requireEnvironment();
  const existingGroups = await getUserGroups(username);

  for (const group of existingGroups) {
    if (SYSTEM_GROUPS.includes(group) && group !== requestedRole) {
      await cognitoClient.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: userPoolId,
          Username: username,
          GroupName: group,
        }),
      );
    }
  }

  if (!existingGroups.includes(requestedRole)) {
    await cognitoClient.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: username,
        GroupName: requestedRole,
      }),
    );
  }

  const cognitoUser = await getCognitoUser(username);
  const attributes = cognitoUser.attributes;
  const profiles = await scanApplicationUsers();
  const appUser = findApplicationUser(profiles, {
    sub: attributes.sub,
    username,
    email: attributes.email,
  });

  if (appUser) {
    await documentClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: appUser.pk, sk: appUser.sk },
        UpdateExpression: 'SET #role = :role, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':role': requestedRole,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  return success({
    username,
    role: requestedRole,
    maNhom: requestedRole,
    message: 'Cập nhật phân quyền thành công.',
  });
}

async function handleDisableAccount(event) {
  const actor = requireGroups(event, ['ADMIN']);
  const username = routeParameter(event, 'username');

  if (username === actor.username) {
    throw new ValidationError('Không thể vô hiệu hóa chính tài khoản đang đăng nhập.');
  }

  const { userPoolId, tableName } = requireEnvironment();
  await cognitoClient.send(
    new AdminDisableUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );

  const cognitoUser = await getCognitoUser(username);
  const profiles = await scanApplicationUsers();
  const appUser = findApplicationUser(profiles, {
    sub: cognitoUser.attributes.sub,
    username,
    email: cognitoUser.attributes.email,
  });

  if (appUser) {
    await documentClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { pk: appUser.pk, sk: appUser.sk },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'DISABLED',
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );
  }

  return success({
    username,
    enabled: false,
    message: 'Tài khoản đã được vô hiệu hóa.',
  });
}

async function handler(event) {
  const routeKey = getRouteKey(event);

  try {
    switch (routeKey) {
      case 'GET /api/health':
        return await handleHealth();
      case 'GET /api/me':
      case 'GET /api/auth/me':
        return await handleMe(event);
      case 'GET /api/admin/ping':
        return await handleAdminPing(event);
      case 'GET /api/tai-khoan':
        return await handleListAccounts(event);
      case 'PUT /api/tai-khoan/{username}':
        return await handleUpdateAccountRole(event);
      case 'DELETE /api/tai-khoan/{username}':
        return await handleDisableAccount(event);
      default:
        return failure(
          404,
          'ROUTE_NOT_FOUND',
          `Không tìm thấy route ${routeKey || '(unknown)'}`,
        );
    }
  } catch (error) {
    if (error instanceof AuthError || error instanceof ValidationError) {
      return failure(
        error.statusCode,
        error.code,
        error.message,
        error.details,
      );
    }

    console.error('Unhandled core Lambda error', {
      routeKey,
      message: error?.message,
      stack: error?.stack,
    });

    return failure(
      500,
      'INTERNAL_ERROR',
      'Hệ thống đang gặp lỗi, vui lòng thử lại sau.',
    );
  }
}

module.exports = {
  handler,
  handleHealth,
  handleMe,
  handleAdminPing,
  handleListAccounts,
  handleUpdateAccountRole,
  handleDisableAccount,
  convertAttributes,
  findApplicationUser,
};
