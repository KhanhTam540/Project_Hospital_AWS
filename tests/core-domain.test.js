'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDateTime,
  isTimeWithinShift,
  mapDepartment,
  normalizeAccountPayload,
  normalizeAppointmentPayload,
  normalizeAppointmentStatus,
  normalizeDepartmentPayload,
} = require('../services/core/domain');

test('normalizeAccountPayload validates a strong Cognito password', () => {
  const payload = normalizeAccountPayload({
    tenDangNhap: 'doctor001',
    email: 'doctor@example.com',
    matKhau: 'P2TB@Test123!',
    maNhom: 'BACSI',
    maKhoa: 'KHOA_NOI',
    hoTen: 'Bác sĩ kiểm thử',
  });

  assert.equal(payload.role, 'BACSI');
  assert.equal(payload.departmentId, 'KHOA_NOI');
});

test('department payload and mapper keep legacy Vietnamese fields', () => {
  const payload = normalizeDepartmentPayload({
    tenKhoa: 'Khoa Tim mạch',
    moTa: 'Kiểm thử',
  });
  const mapped = mapDepartment({
    ...payload,
    entityType: 'DEPARTMENT',
  });

  assert.match(payload.departmentId, /^KHOA_/);
  assert.equal(mapped.tenKhoa, 'Khoa Tim mạch');
});

test('legacy appointment statuses are normalized', () => {
  assert.equal(normalizeAppointmentStatus('PENDING'), 'CHO_THANH_TOAN');
  assert.equal(normalizeAppointmentStatus('CONFIRMED'), 'DA_THANH_TOAN');
});

test('appointment payload creates a timezone-aware datetime', () => {
  const payload = normalizeAppointmentPayload({
    maLich: 'LH_TEST',
    maBN: 'BN001',
    maBS: 'BS001',
    maKhoa: 'KHOA_NOI',
    ngayKham: '2099-07-01',
    gioKham: '08:30',
  });

  assert.equal(payload.appointmentDateTime, '2099-07-01T08:30:00+07:00');
});

test('shift time helper validates schedule ranges', () => {
  assert.equal(
    isTimeWithinShift('08:30', {
      startTime: '07:00',
      endTime: '12:00',
    }),
    true,
  );
  assert.equal(
    isTimeWithinShift('13:00', {
      startTime: '07:00',
      endTime: '12:00',
    }),
    false,
  );
});

test('createDateTime uses Vietnam offset', () => {
  assert.equal(createDateTime('2099-01-01', '09:00'), '2099-01-01T09:00:00+07:00');
});
