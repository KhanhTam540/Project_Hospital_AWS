'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AuthError,
  getGroups,
  getCurrentUser,
  requireGroups,
} = require('../services/shared/auth');

function eventWithGroups(groups) {
  return {
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: 'user-sub-001',
            'cognito:username': 'demo@example.com',
            'cognito:groups': groups,
          },
        },
      },
    },
  };
}

test('getGroups parses Cognito string format', () => {
  assert.deepEqual(getGroups(eventWithGroups('[ADMIN, BACSI]')), ['ADMIN', 'BACSI']);
});

test('getCurrentUser determines the primary role', () => {
  assert.equal(getCurrentUser(eventWithGroups('[NHANSU]')).primaryRole, 'NHANSU');
});

test('ADMIN is allowed through requireGroups', () => {
  assert.equal(requireGroups(eventWithGroups('[ADMIN]'), ['ADMIN']).sub, 'user-sub-001');
});

test('BENHNHAN is denied from ADMIN route', () => {
  assert.throws(
    () => requireGroups(eventWithGroups('[BENHNHAN]'), ['ADMIN']),
    (error) => error instanceof AuthError && error.statusCode === 403,
  );
});
