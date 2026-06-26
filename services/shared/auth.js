'use strict';

const SYSTEM_GROUPS = Object.freeze(['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);
const ROLE_PRIORITY = Object.freeze(['ADMIN', 'BACSI', 'NHANSU', 'BENHNHAN']);

class AuthError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getJwtClaims(event = {}) {
  return (
    event.requestContext?.authorizer?.jwt?.claims ||
    event.requestContext?.authorizer?.claims ||
    {}
  );
}

function normalizeGroupName(value) {
  return String(value || '').trim().toUpperCase();
}

function parseGroupsClaim(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return [...new Set(value.map(normalizeGroupName).filter(Boolean))];
  }

  const text = String(value).trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map(normalizeGroupName).filter(Boolean))];
    }
  } catch {
    // Cognito often serializes this claim as "[ADMIN, BACSI]", which is not JSON.
  }

  return [
    ...new Set(
      text
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((group) => group.replace(/^['"]|['"]$/g, ''))
        .map(normalizeGroupName)
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
  return claims['cognito:username'] || claims.username || claims.email || claims.sub;
}

function getPrimaryRole(groups) {
  for (const role of ROLE_PRIORITY) {
    if (groups.includes(role)) return role;
  }
  return null;
}

function getCurrentUser(event = {}) {
  const claims = getJwtClaims(event);
  const groups = getGroups(event);

  return {
    sub: getSubject(event),
    username: getUsername(event),
    email: claims.email || null,
    groups,
    primaryRole: getPrimaryRole(groups),
    claims,
  };
}

function isInGroup(event, group) {
  return getGroups(event).includes(normalizeGroupName(group));
}

function hasAnyGroup(event, allowedGroups = []) {
  const currentGroups = new Set(getGroups(event));
  return allowedGroups.map(normalizeGroupName).some((group) => currentGroups.has(group));
}

function requireAuthenticated(event) {
  const user = getCurrentUser(event);
  if (!user.sub) {
    throw new AuthError(401, 'UNAUTHORIZED', 'Bạn chưa đăng nhập hoặc JWT không hợp lệ');
  }
  return user;
}

function requireGroups(event, allowedGroups = []) {
  const user = requireAuthenticated(event);
  const normalizedAllowedGroups = allowedGroups.map(normalizeGroupName);

  if (normalizedAllowedGroups.length === 0) return user;
  if (!normalizedAllowedGroups.some((group) => user.groups.includes(group))) {
    throw new AuthError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này');
  }

  return user;
}

module.exports = {
  SYSTEM_GROUPS,
  ROLE_PRIORITY,
  AuthError,
  getJwtClaims,
  parseGroupsClaim,
  getGroups,
  getSubject,
  getUsername,
  getPrimaryRole,
  getCurrentUser,
  isInGroup,
  hasAnyGroup,
  requireAuthenticated,
  requireGroups,
};
