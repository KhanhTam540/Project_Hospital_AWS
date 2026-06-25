'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../services/core/handler');

function protectedEvent(routeKey, groups) {
  return {
    routeKey,
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: 'sub-001',
            'cognito:username': 'demo@example.com',
            'cognito:groups': groups,
          },
        },
      },
    },
  };
}

test('/api/health returns 200', async () => {
  const response = await handler({ routeKey: 'GET /api/health' });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).data.status, 'ok');
});

test('/api/me returns JWT user information', async () => {
  const response = await handler(protectedEvent('GET /api/me', '[BACSI]'));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body).data.groups, ['BACSI']);
});

test('/api/admin/ping accepts ADMIN', async () => {
  const response = await handler(protectedEvent('GET /api/admin/ping', '[ADMIN]'));
  assert.equal(response.statusCode, 200);
});

test('/api/admin/ping rejects BENHNHAN', async () => {
  const response = await handler(protectedEvent('GET /api/admin/ping', '[BENHNHAN]'));
  assert.equal(response.statusCode, 403);
});
