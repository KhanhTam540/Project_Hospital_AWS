'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { routeHandlers } = require('../services/medical/handler');
const {
  mapDepartment,
  mapDoctor,
  mapFeedback,
  mapLabTest,
  mapLabTestType,
  mapNews,
  mapStaff,
} = require('../services/medical/admin-features');

const REQUIRED_ROUTES = [
  'GET /api/public/khoa',
  'GET /api/public/bacsi',
  'GET /api/public/tintuc',
  'GET /api/public/tintuc/{newsId}',
  'GET /api/bacsi',
  'POST /api/bacsi',
  'DELETE /api/bacsi/{doctorId}',
  'GET /api/nhansu',
  'POST /api/nhansu',
  'DELETE /api/nhansu/{staffId}',
  'GET /api/loaixetnghiem',
  'POST /api/loaixetnghiem',
  'GET /api/xetnghiem',
  'POST /api/xetnghiem',
  'GET /api/phanhoi',
  'POST /api/phanhoi',
  'GET /api/tintuc',
  'POST /api/tintuc',
];

test('requested feature routes are registered', () => {
  for (const route of REQUIRED_ROUTES) {
    assert.equal(typeof routeHandlers[route], 'function', `Missing route ${route}`);
  }
});

test('legacy mapping functions expose frontend field names', () => {
  const department = mapDepartment({
    departmentId: 'KHOA_NOI',
    departmentName: 'Khoa Nội',
    description: 'Nội tổng quát',
    status: 'ACTIVE',
  });
  assert.equal(department.maKhoa, 'KHOA_NOI');
  assert.equal(department.tenKhoa, 'Khoa Nội');

  const departments = new Map([
    ['KHOA_NOI', {
      departmentId: 'KHOA_NOI',
      departmentName: 'Khoa Nội',
      status: 'ACTIVE',
    }],
  ]);
  assert.equal(
    mapDoctor({
      doctorId: 'BS001',
      departmentId: 'KHOA_NOI',
      fullName: 'Bác sĩ A',
      status: 'ACTIVE',
    }, departments).maBS,
    'BS001',
  );
  assert.equal(
    mapStaff({
      staffId: 'NS001',
      departmentId: 'KHOA_NOI',
      fullName: 'Nhân sự A',
      staffType: 'YT',
      status: 'ACTIVE',
    }, departments).maNS,
    'NS001',
  );

  const testType = {
    testTypeId: 'LXN001',
    name: 'Huyết học',
    status: 'ACTIVE',
  };
  assert.equal(mapLabTestType(testType).maLoaiXN, 'LXN001');
  assert.equal(
    mapLabTest({
      testId: 'XN001',
      testTypeId: 'LXN001',
      name: 'Công thức máu',
      price: 100000,
      status: 'ACTIVE',
    }, new Map([['LXN001', testType]])).maXN,
    'XN001',
  );

  assert.equal(mapFeedback({ feedbackId: 'PH001' }).maPH, 'PH001');
  assert.equal(mapNews({ newsId: 'TIN001', title: 'Tin mới' }).maTin, 'TIN001');
});
