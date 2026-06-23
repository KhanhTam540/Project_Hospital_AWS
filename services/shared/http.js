class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  },
  body: JSON.stringify(body),
});

const parseJsonBody = (body) => {
  if (!body) {
    throw new ApiError(400, 'Request body is required');
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
};

const getJwtClaims = (event) =>
  event?.requestContext?.authorizer?.jwt?.claims || {};

const getSubject = (event) => {
  const subject = getJwtClaims(event).sub;
  return typeof subject === 'string' && subject.trim()
    ? subject.trim()
    : undefined;
};

const getGroups = (event) => {
  const value = getJwtClaims(event)['cognito:groups'];

  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String);
    }
  } catch {
    // API Gateway can expose this claim as a comma-separated string.
  }

  return value
    .replace(/[\[\]"]/g, '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);
};

const requireAuthenticated = (event) => {
  const subject = getSubject(event);
  if (!subject) {
    throw new ApiError(401, 'Unauthorized');
  }
  return subject;
};

const hasAnyGroup = (event, allowedGroups) => {
  const groups = getGroups(event);
  return groups.some((group) => allowedGroups.includes(group));
};

const requireAnyGroup = (event, allowedGroups) => {
  requireAuthenticated(event);
  if (!hasAnyGroup(event, allowedGroups)) {
    throw new ApiError(403, 'Forbidden');
  }
};

const routeParameter = (event, name) => {
  const value = event?.pathParameters?.[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${name} is required`);
  }
  return value.trim();
};

const queryParameter = (event, name) => {
  const value = event?.queryStringParameters?.[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${name} query parameter is required`);
  }
  return value.trim();
};

const handleError = (error, context = 'Request failed') => {
  if (error instanceof ApiError) {
    return json(error.statusCode, {
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  console.error(context, error);
  return json(500, { message: 'Internal server error' });
};

module.exports = {
  ApiError,
  getGroups,
  getJwtClaims,
  getSubject,
  handleError,
  hasAnyGroup,
  json,
  parseJsonBody,
  queryParameter,
  requireAnyGroup,
  requireAuthenticated,
  routeParameter,
};
