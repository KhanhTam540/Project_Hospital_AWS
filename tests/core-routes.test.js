'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handlers } = require('../services/core/routes');

const REQUIRED_ROUTES = [
  'GET /api/health',
  'GET /api/me',
  'GET /api/admin/ping',
  'GET /api/tai-khoan',
  'POST /api/tai-khoan',
  'GET /api/khoa',
  'POST /api/khoa',
  'GET /api/phongkham',
  'POST /api/phongkham',
  'GET /api/bacsi',
  'POST /api/bacsi',
  'GET /api/nhansu',
  'POST /api/nhansu',
  'GET /api/catruc',
  'POST /api/catruc',
  'GET /api/lichlamviec',
  'POST /api/lichlamviec',
  'GET /api/lichkham',
  'POST /api/lichkham',
  'PATCH /api/lichkham/{appointmentId}/status',
];

test('all Hoàng Phúc week 1-2 routes are registered', () => {
  for (const route of REQUIRED_ROUTES) {
    assert.equal(typeof handlers[route], 'function', `Missing route ${route}`);
  }
});
