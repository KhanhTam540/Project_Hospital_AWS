'use strict';

const {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
} = require(
  '@aws-sdk/client-cognito-identity-provider',
);

const {
  success,
  failure,
  getRouteKey,
} = require('../shared/http');

const {
  AuthError,
  getCurrentUser,
  requireAuthenticated,
  requireGroups,
} = require('../shared/auth');

const {
  ValidationError,
} = require('../shared/validation');

const PROJECT_NAME = 'Hospital_P2TB';

const cognitoClient =
  new CognitoIdentityProviderClient({});

function convertAttributes(attributes = []) {
  return Object.fromEntries(
    attributes.map((attribute) => [
      attribute.Name,
      attribute.Value,
    ]),
  );
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
  requireAuthenticated(event);

  const user = getCurrentUser(event);

  return success({
    sub: user.sub,
    username: user.username,
    email: user.email,
    groups: user.groups,
    primaryRole: user.primaryRole,
  });
}

async function handleAdminPing(event) {
  const user = requireGroups(
    event,
    ['ADMIN'],
  );

  return success({
    message: 'Admin access granted',

    actor: {
      sub: user.sub,
      username: user.username,
      groups: user.groups,
    },
  });
}

async function getUserGroups(username) {
  const userPoolId =
    process.env.USER_POOL_ID;

  const response =
    await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );

  return (response.Groups || []).map(
    (group) => group.GroupName,
  );
}

async function handleListAccounts(event) {
  requireGroups(event, ['ADMIN']);

  const userPoolId =
    process.env.USER_POOL_ID;

  if (!userPoolId) {
    throw new Error(
      'Missing USER_POOL_ID environment variable',
    );
  }

  const cognitoUsers = [];

  let paginationToken;

  do {
    const response =
      await cognitoClient.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Limit: 60,
          PaginationToken: paginationToken,
        }),
      );

    cognitoUsers.push(
      ...(response.Users || []),
    );

    paginationToken =
      response.PaginationToken;
  } while (paginationToken);

  const users = await Promise.all(
    cognitoUsers.map(async (user) => {
      const attributes =
        convertAttributes(
          user.Attributes,
        );

      let groups = [];

      try {
        groups =
          await getUserGroups(
            user.Username,
          );
      } catch (error) {
        console.error(
          'Cannot load user groups',
          {
            username:
              user.Username,

            message:
              error.message,
          },
        );
      }

      return {
        id:
          attributes.sub ||
          user.Username,

        username:
          user.Username,

        email:
          attributes.email || null,

        emailVerified:
          attributes.email_verified ===
          'true',

        phoneNumber:
          attributes.phone_number || null,

        enabled:
          user.Enabled === true,

        confirmationStatus:
          user.UserStatus || null,

        groups,

        primaryRole:
          groups.includes('ADMIN')
            ? 'ADMIN'
            : groups.includes('BACSI')
              ? 'BACSI'
              : groups.includes('NHANSU')
                ? 'NHANSU'
                : groups.includes('BENHNHAN')
                  ? 'BENHNHAN'
                  : null,

        createdAt:
          user.UserCreateDate
            ? user.UserCreateDate
                .toISOString()
            : null,

        updatedAt:
          user.UserLastModifiedDate
            ? user.UserLastModifiedDate
                .toISOString()
            : null,
      };
    }),
  );

  users.sort((first, second) =>
    String(first.email || first.username)
      .localeCompare(
        String(
          second.email ||
          second.username,
        ),
      ),
  );

  return success({
    users,
    total: users.length,

    summary: {
      admin:
        users.filter(
          (user) =>
            user.groups.includes(
              'ADMIN',
            ),
        ).length,

      doctor:
        users.filter(
          (user) =>
            user.groups.includes(
              'BACSI',
            ),
        ).length,

      staff:
        users.filter(
          (user) =>
            user.groups.includes(
              'NHANSU',
            ),
        ).length,

      patient:
        users.filter(
          (user) =>
            user.groups.includes(
              'BENHNHAN',
            ),
        ).length,

      unconfirmed:
        users.filter(
          (user) =>
            user.confirmationStatus ===
            'UNCONFIRMED',
        ).length,
    },
  });
}

async function handler(event) {
  const routeKey =
    getRouteKey(event);

  try {
    switch (routeKey) {
      case 'GET /api/health':
        return await handleHealth();

      case 'GET /api/me':
        return await handleMe(event);

      case 'GET /api/admin/ping':
        return await handleAdminPing(
          event,
        );

      case 'GET /api/tai-khoan':
        return await handleListAccounts(
          event,
        );

      default:
        return failure(
          404,
          'ROUTE_NOT_FOUND',
          `Không tìm thấy route ${
            routeKey || '(unknown)'
          }`,
        );
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return failure(
        error.statusCode,
        error.code,
        error.message,
      );
    }

    if (
      error instanceof
      ValidationError
    ) {
      return failure(
        error.statusCode,
        error.code,
        error.message,
        error.details,
      );
    }

    console.error(
      'Unhandled core Lambda error',
      {
        routeKey,
        message:
          error?.message,

        stack:
          error?.stack,
      },
    );

    return failure(
      500,
      'INTERNAL_ERROR',
      'Hệ thống đang gặp lỗi, vui lòng thử lại sau',
    );
  }
}

module.exports = {
  handler,
  handleHealth,
  handleMe,
  handleAdminPing,
  handleListAccounts,
};