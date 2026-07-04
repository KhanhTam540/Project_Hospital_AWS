'use strict';

const {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const { ApiError } = require('../shared/http');
const { SYSTEM_ROLES, normalizeEmail } = require('./domain');

let cognitoClient;

function getClient() {
  if (!cognitoClient) {
    cognitoClient = new CognitoIdentityProviderClient({});
  }
  return cognitoClient;
}

function getUserPoolId() {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    throw new Error('Missing USER_POOL_ID environment variable');
  }
  return userPoolId;
}

function convertAttributes(attributes = []) {
  return Object.fromEntries(
    attributes
      .filter((attribute) => attribute?.Name)
      .map((attribute) => [attribute.Name, attribute.Value]),
  );
}

function toAttributeList(values = {}) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([Name, Value]) => ({ Name, Value: String(Value) }));
}

async function listUsers() {
  const users = [];
  let paginationToken;

  do {
    const response = await getClient().send(
      new ListUsersCommand({
        UserPoolId: getUserPoolId(),
        Limit: 60,
        PaginationToken: paginationToken,
      }),
    );

    users.push(...(response.Users || []));
    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return users;
}

async function getGroups(username) {
  const response = await getClient().send(
    new AdminListGroupsForUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
    }),
  );

  return (response.Groups || [])
    .map((group) => group.GroupName)
    .filter(Boolean);
}

async function getUser(username) {
  try {
    const response = await getClient().send(
      new AdminGetUserCommand({
        UserPoolId: getUserPoolId(),
        Username: username,
      }),
    );

    return {
      username: response.Username || username,
      enabled: response.Enabled !== false,
      status: response.UserStatus || null,
      createdAt: response.UserCreateDate?.toISOString() || null,
      updatedAt: response.UserLastModifiedDate?.toISOString() || null,
      attributes: convertAttributes(response.UserAttributes),
      groups: await getGroups(username),
    };
  } catch (error) {
    if (error?.name === 'UserNotFoundException') {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản Cognito');
    }
    throw error;
  }
}

async function createUser(payload) {
  const attributes = {
    email: normalizeEmail(payload.email),
    email_verified: 'true',
    name: payload.fullName,
    // Cognito chỉ chấp nhận phone_number theo chuẩn E.164.
    phone_number:
      /^\+[1-9]\d{7,14}$/.test(String(payload.phoneNumber || '').trim())
        ? String(payload.phoneNumber).trim()
        : undefined,
  };

  try {
    const response = await getClient().send(
      new AdminCreateUserCommand({
        UserPoolId: getUserPoolId(),
        Username: payload.username,
        TemporaryPassword: payload.password,
        MessageAction: 'SUPPRESS',
        UserAttributes: toAttributeList(attributes),
      }),
    );

    await getClient().send(
      new AdminSetUserPasswordCommand({
        UserPoolId: getUserPoolId(),
        Username: payload.username,
        Password: payload.password,
        Permanent: true,
      }),
    );

    // Đọc lại để nhận đúng sub, trạng thái CONFIRMED và attributes.
    return await getUser(response.User?.Username || payload.username);
  } catch (error) {
    if (error?.name === 'UsernameExistsException') {
      throw new ApiError(409, 'USERNAME_EXISTS', 'Tên đăng nhập đã tồn tại');
    }
    if (error?.name === 'AliasExistsException') {
      throw new ApiError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
    }
    if (error?.name === 'InvalidPasswordException') {
      throw new ApiError(400, 'INVALID_PASSWORD', error.message);
    }
    throw error;
  }
}

async function setPrimaryGroup(username, requestedRole) {
  if (!SYSTEM_ROLES.includes(requestedRole)) {
    throw new ApiError(400, 'INVALID_ROLE', 'Vai trò Cognito không hợp lệ');
  }

  const currentGroups = await getGroups(username);

  for (const group of currentGroups) {
    if (SYSTEM_ROLES.includes(group) && group !== requestedRole) {
      await getClient().send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: getUserPoolId(),
          Username: username,
          GroupName: group,
        }),
      );
    }
  }

  if (!currentGroups.includes(requestedRole)) {
    await getClient().send(
      new AdminAddUserToGroupCommand({
        UserPoolId: getUserPoolId(),
        Username: username,
        GroupName: requestedRole,
      }),
    );
  }

  return requestedRole;
}

async function updateAttributes(username, attributes = {}) {
  const phoneNumber = String(attributes.phoneNumber || '').trim();
  const list = toAttributeList({
    email: attributes.email ? normalizeEmail(attributes.email) : undefined,
    email_verified: attributes.email ? 'true' : undefined,
    name: attributes.fullName,
    phone_number: /^\+[1-9]\d{7,14}$/.test(phoneNumber)
      ? phoneNumber
      : undefined,
  });

  if (list.length === 0) return;

  await getClient().send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
      UserAttributes: list,
    }),
  );
}

async function disableUser(username) {
  await getClient().send(
    new AdminDisableUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
    }),
  );
}

async function enableUser(username) {
  await getClient().send(
    new AdminEnableUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
    }),
  );
}

async function deleteUser(username) {
  await getClient().send(
    new AdminDeleteUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
    }),
  );
}

async function resendInvitation(username) {
  const existing = await getUser(username);
  if (existing.status !== 'FORCE_CHANGE_PASSWORD') {
    throw new ApiError(
      409,
      'INVITATION_NOT_AVAILABLE',
      'Chỉ có thể gửi lại email mời cho tài khoản đang dùng mật khẩu tạm',
    );
  }

  await getClient().send(
    new AdminCreateUserCommand({
      UserPoolId: getUserPoolId(),
      Username: username,
      MessageAction: 'RESEND',
      DesiredDeliveryMediums: ['EMAIL'],
    }),
  );
}

module.exports = {
  convertAttributes,
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  getGroups,
  getUser,
  getUserPoolId,
  listUsers,
  resendInvitation,
  setPrimaryGroup,
  updateAttributes,
};
