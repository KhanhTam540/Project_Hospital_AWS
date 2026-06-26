'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { json, success, failure, parseJsonBody, getRouteKey } = require('../services/shared/http');

test('json creates an API Gateway response', () => {
  const response = json(200, { ok: true });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test('success and failure use a consistent envelope', () => {
  assert.deepEqual(JSON.parse(success({ id: 1 }).body), { success: true, data: { id: 1 } });
  assert.deepEqual(JSON.parse(failure(403, 'FORBIDDEN', 'Denied').body), {
    success: false,
    error: { code: 'FORBIDDEN', message: 'Denied' },
  });
});

test('parseJsonBody accepts event or raw body', () => {
  assert.deepEqual(parseJsonBody('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonBody({ body: '{"b":2}' }), { b: 2 });
});

test('getRouteKey derives route from HTTP API event', () => {
  assert.equal(getRouteKey({ requestContext: { http: { method: 'GET' } }, rawPath: '/api/health' }), 'GET /api/health');
});
