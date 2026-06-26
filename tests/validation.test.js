'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ValidationError,
  requireEmail,
  requirePhone,
  requireOneOf,
} = require('../services/shared/validation');

test('requireEmail normalizes a valid email', () => {
  assert.equal(requireEmail(' Admin@P2TB.Example.com '), 'admin@p2tb.example.com');
});

test('requireEmail rejects invalid email', () => {
  assert.throws(() => requireEmail('invalid-email'), ValidationError);
});

test('requirePhone validates Vietnamese-style sample phone', () => {
  assert.equal(requirePhone('0900000001'), '0900000001');
});

test('requireOneOf validates enum values', () => {
  assert.equal(requireOneOf('active', 'status', ['ACTIVE', 'INACTIVE']), 'ACTIVE');
});
