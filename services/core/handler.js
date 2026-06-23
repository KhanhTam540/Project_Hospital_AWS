const {
  getGroups,
  getJwtClaims,
  handleError,
  json,
  requireAnyGroup,
  requireAuthenticated,
} = require('../shared/http');

exports.handler = async (event) => {
  try {
    switch (event.routeKey) {
      case 'GET /api/health':
        return json(200, {
          service: 'hospital-api',
          status: 'ok',
          environment: 'dev',
          region: process.env.AWS_REGION,
          timestamp: new Date().toISOString(),
        });

      case 'GET /api/me': {
        const subject = requireAuthenticated(event);
        const claims = getJwtClaims(event);

        return json(200, {
          subject,
          email: typeof claims.email === 'string' ? claims.email : null,
          username:
            typeof claims.username === 'string' ? claims.username : null,
          groups: getGroups(event),
        });
      }

      case 'GET /api/admin/ping':
        requireAnyGroup(event, ['ADMIN']);
        return json(200, {
          message: 'Admin access granted',
          timestamp: new Date().toISOString(),
        });

      default:
        return json(404, { message: 'Route not found' });
    }
  } catch (error) {
    return handleError(error, 'Core API request failed');
  }
};
