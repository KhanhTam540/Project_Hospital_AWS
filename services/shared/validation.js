'use strict';

class ValidationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function requiredString(value, fieldName, options = {}) {
  const { minLength = 1, maxLength = 500 } = options;
  const text = cleanString(value);

  if (typeof text !== 'string' || text.length < minLength) {
    throw new ValidationError(`${fieldName} là trường bắt buộc`);
  }
  if (text.length > maxLength) {
    throw new ValidationError(`${fieldName} không được vượt quá ${maxLength} ký tự`);
  }
  return text;
}

function optionalString(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, fieldName, options);
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function requireEmail(value, fieldName = 'email') {
  const email = requiredString(value, fieldName, { maxLength: 254 }).toLowerCase();
  if (!isValidEmail(email)) throw new ValidationError(`${fieldName} không đúng định dạng`);
  return email;
}

function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  return /^\+?[0-9]{9,15}$/.test(value.trim());
}

function requirePhone(value, fieldName = 'phoneNumber') {
  const phone = requiredString(value, fieldName, { maxLength: 16 });
  if (!isValidPhone(phone)) throw new ValidationError(`${fieldName} không đúng định dạng`);
  return phone;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function requireIsoDate(value, fieldName) {
  const text = requiredString(value, fieldName, { maxLength: 40 });
  if (!isValidIsoDate(text)) throw new ValidationError(`${fieldName} không phải ngày hợp lệ`);
  return new Date(text).toISOString();
}

function requireOneOf(value, fieldName, allowedValues) {
  const normalized = requiredString(value, fieldName).toUpperCase();
  if (!allowedValues.includes(normalized)) {
    throw new ValidationError(`${fieldName} phải thuộc một trong các giá trị: ${allowedValues.join(', ')}`);
  }
  return normalized;
}

function validateRequiredFields(object, fields) {
  const missingFields = fields.filter((field) => {
    const value = object?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missingFields.length > 0) {
    throw new ValidationError('Thiếu dữ liệu bắt buộc', { missingFields });
  }

  return object;
}

module.exports = {
  ValidationError,
  cleanString,
  requiredString,
  optionalString,
  isValidEmail,
  requireEmail,
  isValidPhone,
  requirePhone,
  isValidIsoDate,
  requireIsoDate,
  requireOneOf,
  validateRequiredFields,
};
