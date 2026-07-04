'use strict';

const crypto = require('crypto');
const { ApiError } = require('../shared/http');

function normalizeMoney(value, fieldName = 'amount') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(
      400,
      'INVALID_AMOUNT',
      `${fieldName} must be a positive number`,
    );
  }
  return Math.round(amount);
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toUpperCase();
  const aliases = {
    VNPAY: 'VNPAY',
    VN_PAY: 'VNPAY',
    MOMO: 'MOMO',
    CASH: 'CASH',
    TIEN_MAT: 'CASH',
    BANK: 'BANK_TRANSFER',
    BANK_TRANSFER: 'BANK_TRANSFER',
    CHUYEN_KHOAN: 'BANK_TRANSFER',
  };
  const normalized = aliases[provider];
  if (!normalized) {
    throw new ApiError(
      400,
      'UNSUPPORTED_PAYMENT_PROVIDER',
      'Supported providers are VNPAY, MOMO, CASH and BANK_TRANSFER',
    );
  }
  return normalized;
}

function hmac(algorithm, secret, text) {
  return crypto
    .createHmac(algorithm, String(secret || ''))
    .update(String(text || ''), 'utf8')
    .digest('hex');
}

function sortedQueryString(params = {}) {
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [key, String(value)]);

  return new URLSearchParams(pairs).toString();
}

function signVnpay(params, secret) {
  return hmac('sha512', secret, sortedQueryString(params));
}

function verifyVnpay(params, secret) {
  const copy = { ...params };
  const received = String(
    copy.vnp_SecureHash || copy.vnp_securehash || '',
  ).toLowerCase();
  delete copy.vnp_SecureHash;
  delete copy.vnp_SecureHashType;
  delete copy.vnp_securehash;
  delete copy.vnp_securehashtype;

  if (!received) return false;
  const expected = signVnpay(copy, secret).toLowerCase();
  return timingSafeEqual(expected, received);
}

function momoCreateRawSignature(payload, accessKey) {
  return [
    `accessKey=${accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData || ''}`,
    `ipnUrl=${payload.ipnUrl}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo}`,
    `partnerCode=${payload.partnerCode}`,
    `redirectUrl=${payload.redirectUrl}`,
    `requestId=${payload.requestId}`,
    `requestType=${payload.requestType}`,
  ].join('&');
}

function signMomoCreate(payload, accessKey, secretKey) {
  return hmac(
    'sha256',
    secretKey,
    momoCreateRawSignature(payload, accessKey),
  );
}

function momoCallbackRawSignature(payload, accessKey) {
  return [
    `accessKey=${accessKey}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData || ''}`,
    `message=${payload.message || ''}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo || ''}`,
    `orderType=${payload.orderType || ''}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType || ''}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join('&');
}

function verifyMomoCallback(payload, accessKey, secretKey) {
  const received = String(payload.signature || '').toLowerCase();
  if (!received) return false;
  const expected = hmac(
    'sha256',
    secretKey,
    momoCallbackRawSignature(payload, accessKey),
  ).toLowerCase();
  return timingSafeEqual(expected, received);
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function generateOtp() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function hashOtp({ secret, subject, purpose, otp }) {
  return hmac(
    'sha256',
    secret,
    `${subject}|${String(purpose).toUpperCase()}|${otp}`,
  );
}

function createSignedOtpToken({ secret, subject, purpose, expiresAt }) {
  const payload = Buffer.from(
    JSON.stringify({ subject, purpose, expiresAt }),
    'utf8',
  ).toString('base64url');
  const signature = hmac('sha256', secret, payload);
  return `${payload}.${signature}`;
}

function verifySignedOtpToken({ token, secret, subject, purpose, now }) {
  const [payloadPart, signature] = String(token || '').split('.');
  if (!payloadPart || !signature) return false;
  const expected = hmac('sha256', secret, payloadPart);
  if (!timingSafeEqual(expected, signature)) return false;

  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8'),
    );
  } catch {
    return false;
  }

  const current = Number(now || Date.now());
  return (
    payload.subject === subject &&
    String(payload.purpose).toUpperCase() === String(purpose).toUpperCase() &&
    Number(payload.expiresAt) > current
  );
}

function normalizePhone(value) {
  const raw = String(value || '').replace(/[\s().-]/g, '');
  const normalized = raw.startsWith('0')
    ? `+84${raw.slice(1)}`
    : raw;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new ApiError(
      400,
      'INVALID_PHONE_NUMBER',
      'Phone number must use E.164 format, for example +84901234567',
    );
  }
  return normalized;
}

function vnpDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

module.exports = {
  createSignedOtpToken,
  generateOtp,
  hashOtp,
  hmac,
  momoCallbackRawSignature,
  momoCreateRawSignature,
  normalizeMoney,
  normalizePhone,
  normalizeProvider,
  signMomoCreate,
  signVnpay,
  sortedQueryString,
  timingSafeEqual,
  verifyMomoCallback,
  verifySignedOtpToken,
  verifyVnpay,
  vnpDate,
};
