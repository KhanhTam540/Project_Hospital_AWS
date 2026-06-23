const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ApiError,
  getGroups,
  requireAnyGroup,
} = require('../services/shared/http');

const eventWithGroups = (value) => ({
  requestContext: {
    authorizer: {
      jwt: {
        claims: {
          sub: 'user-123',
          'cognito:groups': value,
        },
      },
    },
  },
});

test('getGroups reads JSON array string', () => {
  assert.deepEqual(getGroups(eventWithGroups('["ADMIN","BACSI"]')), [
    'ADMIN',
    'BACSI',
  ]);
});

test('getGroups reads comma separated string', () => {
  assert.deepEqual(getGroups(eventWithGroups('ADMIN, NHANSU')), [
    'ADMIN',
    'NHANSU',
  ]);
});

test('requireAnyGroup rejects unauthorized group', () => {
  assert.throws(
    () => requireAnyGroup(eventWithGroups('BENHNHAN'), ['ADMIN']),
    (error) => error instanceof ApiError && error.statusCode === 403,
  );
});
