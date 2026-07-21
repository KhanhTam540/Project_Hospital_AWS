'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSignedOtpToken,
  hashOtp,
  normalizeMoney,
  normalizePhone,
  signMomoCreate,
  signVnpay,
  verifySignedOtpToken,
  verifyVnpay,
} = require('../services/payment-sms/domain');

test('normalizes Vietnamese mobile number to E.164', () => {
  assert.equal(normalizePhone('0901 234 567'), '+84901234567');
});

test('rejects non-positive payment amount', () => {
  assert.throws(() => normalizeMoney(0), /positive number/);
});

test('VNPAY signature is stable and verifiable', () => {
  const params = {
    vnp_Amount: 50000000,
    vnp_TmnCode: 'TEST',
    vnp_TxnRef: 'REQ001',
  };
  const signature = signVnpay(params, 'secret');
  assert.equal(
    verifyVnpay({ ...params, vnp_SecureHash: signature }, 'secret'),
    true,
  );
  assert.equal(
    verifyVnpay({ ...params, vnp_Amount: 1, vnp_SecureHash: signature }, 'secret'),
    false,
  );
});

test('MoMo create signature is deterministic', () => {
  const payload = {
    amount: '500000',
    extraData: '',
    ipnUrl: 'https://example.com/ipn',
    orderId: 'REQ001',
    orderInfo: 'Invoice HD001',
    partnerCode: 'MOMO',
    redirectUrl: 'https://example.com/result',
    requestId: 'REQ001',
    requestType: 'captureWallet',
  };
  assert.equal(
    signMomoCreate(payload, 'access', 'secret'),
    signMomoCreate(payload, 'access', 'secret'),
  );
});

test('OTP hash and signed verification token are bound to subject and purpose', () => {
  const hash = hashOtp({
    secret: 'signing-key',
    subject: 'user-1',
    purpose: 'PAYMENT_HD001',
    otp: '123456',
  });
  assert.match(hash, /^[a-f0-9]{64}$/);

  const expiresAt = Date.now() + 60000;
  const token = createSignedOtpToken({
    secret: 'signing-key',
    subject: 'user-1',
    purpose: 'PAYMENT_HD001',
    expiresAt,
  });
  assert.equal(
    verifySignedOtpToken({
      token,
      secret: 'signing-key',
      subject: 'user-1',
      purpose: 'PAYMENT_HD001',
      now: Date.now(),
    }),
    true,
  );
  assert.equal(
    verifySignedOtpToken({
      token,
      secret: 'signing-key',
      subject: 'user-2',
      purpose: 'PAYMENT_HD001',
      now: Date.now(),
    }),
    false,
  );
});
