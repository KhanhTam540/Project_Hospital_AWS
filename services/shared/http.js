'use strict';

const DEFAULT_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
});

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
    input && typeof input === 'object' && Object.prototype.hasOwnProperty.call(input, 'body')
      ? input.body
      : input;

  if (rawBody === undefined || rawBody === null || rawBody === '') {
    throw new Error('Request body is required');
  }

  if (typeof rawBody === 'object') return rawBody;
  if (typeof rawBody !== 'string') {
    throw new Error('Request body must be a JSON string');
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Request body is not valid JSON');
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
  const separatorIndex = routeKey.indexOf(' ');
  return separatorIndex >= 0 ? routeKey.slice(separatorIndex + 1) : '';
}

function getRouteKey(event = {}) {
  if (event.routeKey) return event.routeKey;
  return `${getMethod(event)} ${getPath(event)}`.trim();
}

// Backward-compatible exports for older Lambda files that imported these helpers
// from shared/http.js.
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

module.exports = {
  DEFAULT_HEADERS,
  json,
  success,
  failure,
  parseJsonBody,
  getMethod,
  getPath,
  getRouteKey,
  getJwtClaims,
  getSubject,
};
