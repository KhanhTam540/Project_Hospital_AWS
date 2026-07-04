'use strict';

const { ApiError } = require('./http');

const SYSTEM_GROUPS = Object.freeze([
  'ADMIN',
  'BACSI',
  'NHANSU',
  'BENHNHAN',
]);
const ROLE_PRIORITY = Object.freeze([
  'ADMIN',
  'BACSI',
  'NHANSU',
  'BENHNHAN',
]);

class AuthError extends ApiError {
  constructor(statusCode, code, message) {
    super(statusCode, code, message);
    this.name = 'AuthError';
  }
}

function normalizeGroup(value) {
  return String(value || '').trim().toUpperCase();
}

function getJwtClaims(event = {}) {
  return (
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {}
  );
}

function parseGroupsClaim(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeGroup).filter(Boolean))];
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(normalizeGroup).filter(Boolean))];
    }
  } catch {
    // API Gateway can expose cognito:groups as a comma-separated string.
  }

  return [
    ...new Set(
      text
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((group) => group.replace(/^['"]|['"]$/g, ''))
        .map(normalizeGroup)
        .filter(Boolean),
    ),
  ];
}

function getGroups(event = {}) {
  return parseGroupsClaim(getJwtClaims(event)['cognito:groups']);
}

function getSubject(event = {}) {
  const claims = getJwtClaims(event);
  return claims.sub || claims.username || claims['cognito:username'];
}

function getUsername(event = {}) {
  const claims = getJwtClaims(event);
  return (
    claims['cognito:username'] ||
    claims.username ||
    claims.email ||
    claims.sub ||
    null
  );
}

function getPrimaryRole(groups = []) {
  for (const role of ROLE_PRIORITY) {
    if (groups.includes(role)) return role;
  }
  return null;
}

function getCurrentUser(event = {}) {
  const claims = getJwtClaims(event);
  const groups = getGroups(event);
  const sub = getSubject(event) || null;

  return {
    sub,
    username: getUsername(event),
    email: claims.email || null,
    groups,
    primaryRole: getPrimaryRole(groups),
    claims,
  };
}

function isInGroup(event, group) {
  return getGroups(event).includes(normalizeGroup(group));
}

function hasAnyGroup(event, allowedGroups = []) {
  const current = new Set(getGroups(event));
  return allowedGroups.map(normalizeGroup).some((group) => current.has(group));
}

function requireAuthenticated(event) {
  const user = getCurrentUser(event);
  if (!user.sub) {
    throw new AuthError(401, 'UNAUTHORIZED', 'Authentication is required');
  }
  return user;
}

function requireGroups(event, allowedGroups = []) {
  const user = requireAuthenticated(event);
  const normalized = allowedGroups.map(normalizeGroup);

  if (
    normalized.length > 0 &&
    !normalized.some((group) => user.groups.includes(group))
  ) {
    throw new AuthError(
      403,
      'FORBIDDEN',
      'You do not have permission to perform this action',
    );
  }

  return user;
}

function hasGroup(userOrEvent, group) {
  const groups = Array.isArray(userOrEvent?.groups)
    ? userOrEvent.groups
    : getGroups(userOrEvent);
  return groups.includes(normalizeGroup(group));
}

module.exports = {
  AuthError,
  ROLE_PRIORITY,
  SYSTEM_GROUPS,
  getCurrentUser,
  getGroups,
  getJwtClaims,
  getPrimaryRole,
  getSubject,
  getUsername,
  hasAnyGroup,
  hasGroup,
  isInGroup,
  normalizeGroup,
  parseGroupsClaim,
  requireAuthenticated,
  requireGroups,
};
