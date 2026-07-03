'use strict';

const { ApiError } = require('./http');

class ValidationError extends ApiError {
  constructor(message, details) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

function validationError(message, details) {
  return new ValidationError(message, details);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function requiredString(value, fieldName, options = {}) {
  const { minLength = 1, maxLength = 500 } = options;
  const text = cleanString(value);
  if (typeof text !== 'string' || text.length < minLength) {
    throw validationError(`${fieldName} is required`);
  }
  if (text.length > maxLength) {
    throw validationError(
      `${fieldName} must not exceed ${maxLength} characters`,
    );
  }
  return text;
}

function optionalString(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') return null;
  return requiredString(value, fieldName, options);
}

function isValidEmail(value) {
  return (
    typeof value === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

function requireEmail(value, fieldName = 'email') {
  const email = requiredString(value, fieldName, { maxLength: 254 }).toLowerCase();
  if (!isValidEmail(email)) {
    throw validationError(`${fieldName} is invalid`);
  }
  return email;
}

function isValidPhone(value) {
  return typeof value === 'string' && /^\+?[0-9]{9,15}$/.test(value.trim());
}

function requirePhone(value, fieldName = 'phoneNumber') {
  const phone = requiredString(value, fieldName, { maxLength: 16 });
  if (!isValidPhone(phone)) {
    throw validationError(`${fieldName} is invalid`);
  }
  return phone;
}

function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(new Date(value).getTime());
}

function requiredDate(value, fieldName) {
  const text = requiredString(value, fieldName, { maxLength: 40 });
  if (!isValidIsoDate(text)) {
    throw validationError(`${fieldName} must be a valid date`);
  }
  return new Date(text).toISOString();
}

function requireIsoDate(value, fieldName) {
  return requiredDate(value, fieldName);
}

function dateOnly(value, fieldName) {
  const text = requiredString(value, fieldName, { maxLength: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw validationError(`${fieldName} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${fieldName} must be a valid date`);
  }
  return text;
}

function oneOf(value, fieldName, allowedValues) {
  const normalized = requiredString(value, fieldName).toUpperCase();
  if (!allowedValues.includes(normalized)) {
    throw validationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
    );
  }
  return normalized;
}

function requireOneOf(value, fieldName, allowedValues) {
  return oneOf(value, fieldName, allowedValues);
}

function numberInRange(value, fieldName, options = {}) {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
    required = false,
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required) throw validationError(`${fieldName} is required`);
    return null;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw validationError(`${fieldName} must be a number`);
  }
  if (integer && !Number.isInteger(number)) {
    throw validationError(`${fieldName} must be an integer`);
  }
  if (number < min || number > max) {
    throw validationError(`${fieldName} must be between ${min} and ${max}`);
  }
  return number;
}

function requiredArray(value, fieldName, options = {}) {
  const { minLength = 1, maxLength = 100 } = options;
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} must be an array`);
  }
  if (value.length < minLength || value.length > maxLength) {
    throw validationError(
      `${fieldName} must contain between ${minLength} and ${maxLength} items`,
    );
  }
  return value;
}

function validateRequiredFields(object, fields) {
  const missingFields = fields.filter((field) => {
    const value = object?.[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missingFields.length > 0) {
    throw validationError('Missing required fields', { missingFields });
  }
  return object;
}

module.exports = {
  ValidationError,
  cleanString,
  dateOnly,
  isValidEmail,
  isValidIsoDate,
  isValidPhone,
  numberInRange,
  oneOf,
  optionalString,
  requireEmail,
  requireIsoDate,
  requireOneOf,
  requirePhone,
  requiredArray,
  requiredDate,
  requiredString,
  validateRequiredFields,
  validationError,
};
