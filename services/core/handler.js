'use strict';

const {
  ApiError,
  failure,
  getRouteKey,
} = require('../shared/http');
const {
  AuthError,
} = require('../shared/auth');
const {
  ValidationError,
} = require('../shared/validation');
const { handlers } = require('./routes');

async function handler(event) {
  const routeKey = getRouteKey(event);
  const routeHandler = handlers[routeKey];

  try {
    if (!routeHandler) {
      return failure(
        404,
        'ROUTE_NOT_FOUND',
        `Không tìm thấy route ${routeKey || '(unknown)'}`,
      );
    }

    console.info('Core API request started', {
      routeKey,
      requestId: event?.requestContext?.requestId,
    });

    const response = await routeHandler(event);

    console.info('Core API request completed', {
      routeKey,
      requestId: event?.requestContext?.requestId,
      statusCode: response?.statusCode,
    });

    return response;
  } catch (error) {
    if (
      error instanceof ApiError ||
      error instanceof AuthError ||
      error instanceof ValidationError
    ) {
      return failure(
        error.statusCode,
        error.code,
        error.message,
        error.details,
      );
    }

    console.error('Unhandled core Lambda error', {
      routeKey,
      requestId: event?.requestContext?.requestId,
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
    });

    return failure(
      500,
      'INTERNAL_ERROR',
      'Hệ thống đang gặp lỗi, vui lòng thử lại sau.',
    );
  }
}

module.exports = {
  handler,
  handlers,
};
