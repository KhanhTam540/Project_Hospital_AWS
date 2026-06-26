'use strict';

const DEFAULT_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
});

class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      ...DEFAULT_HEADERS,
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function success(data, statusCode = 200, headers = {}) {
  return json(statusCode, { success: true, data }, headers);
}

function failure(statusCode, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return json(statusCode, { success: false, error });
}

function parseJsonBody(input) {
  const rawBody =
    input &&
    typeof input === 'object' &&
    Object.prototype.hasOwnProperty.call(input, 'body')
      ? input.body
      : input;

  if (rawBody === undefined || rawBody === null || rawBody === '') {
    throw new ApiError(400, 'BODY_REQUIRED', 'Request body is required');
  }

  if (typeof rawBody === 'object') return rawBody;
  if (typeof rawBody !== 'string') {
    throw new ApiError(
      400,
      'INVALID_BODY',
      'Request body must be a JSON string',
    );
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
}


function getMethod(event = {}) {
  return (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    String(event.routeKey || '').split(' ')[0] ||
    ''
  ).toUpperCase();
}

function getPath(event = {}) {
  if (event.rawPath) return event.rawPath;
  if (event.path) return event.path;
  const routeKey = String(event.routeKey || '');
  const index = routeKey.indexOf(' ');
  return index >= 0 ? routeKey.slice(index + 1) : '';
}

function getJwtClaims(event = {}) {
  return (
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {}
  );
}

function getSubject(event = {}) {
  const claims = getJwtClaims(event);
  return claims.sub || claims.username || claims['cognito:username'];
}

function getRouteKey(event = {}) {
  if (event.routeKey) return event.routeKey;

  const method = (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    ''
  ).toUpperCase();
  const path = event.rawPath || event.path || '';
  return `${method} ${path}`.trim();
}

function routeParameter(event, name) {
  const value = event?.pathParameters?.[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, 'PATH_PARAMETER_REQUIRED', `${name} is required`);
  }
  return value.trim();
}

function queryParameter(event, name, { required = true } = {}) {
  const value = event?.queryStringParameters?.[name];
  if (value === undefined || value === null || value === '') {
    if (!required) return undefined;
    throw new ApiError(
      400,
      'QUERY_PARAMETER_REQUIRED',
      `${name} query parameter is required`,
    );
  }
  return String(value).trim();
}

function requestId(event = {}) {
  return (
    event.requestContext?.requestId ||
    event.requestContext?.http?.requestId ||
    'unknown-request'
  );
}

function handleError(error, context = {}) {
  if (error instanceof ApiError) {
    return failure(
      error.statusCode,
      error.code,
      error.message,
      error.details,
    );
  }

  if (error?.name === 'ConditionalCheckFailedException') {
    return failure(409, 'RESOURCE_CONFLICT', 'Resource already exists');
  }

  if (error?.name === 'TransactionCanceledException') {
    return failure(
      409,
      'TRANSACTION_CONFLICT',
      'The request conflicts with existing data',
    );
  }

  console.error('Unhandled API error', {
    ...context,
    name: error?.name,
    message: error?.message,
    stack: error?.stack,
  });

  return failure(500, 'INTERNAL_ERROR', 'Internal server error');
}

module.exports = {
  ApiError,
  DEFAULT_HEADERS,
  failure,
  getJwtClaims,
  getMethod,
  getPath,
  getRouteKey,
  getSubject,
  handleError,
  json,
  parseJsonBody,
  queryParameter,
  requestId,
  routeParameter,
  success,
};
