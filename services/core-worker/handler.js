'use strict';

const { TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { documentClient, getTableName } = require('../shared/dynamodb');
const { ApiError } = require('../shared/http');

const SUPPORTED_EVENTS = new Set([
  'USER_CREATED',
  'USER_UPDATED',
  'USER_DISABLED',
  'USER_ENABLED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_DELETED',
  'ROOM_CREATED',
  'ROOM_UPDATED',
  'ROOM_DELETED',
  'EXTERNAL_CLINIC_CREATED',
  'EXTERNAL_CLINIC_UPDATED',
  'EXTERNAL_CLINIC_DELETED',
  'DOCTOR_CREATED',
  'DOCTOR_UPDATED',
  'DOCTOR_DEACTIVATED',
  'STAFF_CREATED',
  'STAFF_UPDATED',
  'STAFF_DEACTIVATED',
  'SHIFT_CREATED',
  'SHIFT_UPDATED',
  'SHIFT_DELETED',
  'WORK_SCHEDULE_CREATED',
  'WORK_SCHEDULE_UPDATED',
  'WORK_SCHEDULE_DELETED',
  'APPOINTMENT_CREATED',
  'APPOINTMENT_UPDATED',
  'APPOINTMENT_CANCELLED',
]);

function parseMessage(record) {
  let message;
  try {
    message = JSON.parse(record.body);
  } catch {
    throw new ApiError(400, 'INVALID_SQS_MESSAGE', 'SQS message body is not valid JSON');
  }

  if (!message.eventId || !message.eventType || !message.createdAt) {
    throw new ApiError(
      400,
      'INVALID_SQS_MESSAGE',
      'SQS message must contain eventId, eventType and createdAt',
    );
  }

  if (!SUPPORTED_EVENTS.has(message.eventType)) {
    throw new ApiError(
      400,
      'UNSUPPORTED_EVENT',
      `Unsupported event type ${message.eventType}`,
    );
  }

  return message;
}

function notificationTargets(message) {
  const payload = message.payload || {};
  const targets = [];

  if (payload.userId) targets.push(`USER#${payload.userId}`);
  if (payload.patientId) targets.push(`PATIENT#${payload.patientId}`);
  if (payload.doctorId) targets.push(`STAFF#${payload.doctorId}`);

  return [...new Set(targets)];
}

function buildTransaction(message) {
  const tableName = getTableName();
  const now = new Date().toISOString();
  const markerTtl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const auditTtl = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
  const month = message.createdAt.slice(0, 7);

  const transactItems = [
    {
      Put: {
        TableName: tableName,
        Item: {
          pk: `EVENT#${message.eventId}`,
          sk: 'PROCESSED',
          entityType: 'IDEMPOTENCY',
          eventType: message.eventType,
          processedAt: now,
          expiresAt: markerTtl,
        },
        ConditionExpression:
          'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      },
    },
    {
      Put: {
        TableName: tableName,
        Item: {
          pk: `AUDIT#${month}`,
          sk: `${message.createdAt}#${message.eventId}`,
          entityType: 'BACKGROUND_AUDIT',
          eventId: message.eventId,
          eventType: message.eventType,
          actor: message.actor || null,
          payload: message.payload || {},
          processedAt: now,
          expiresAt: auditTtl,
        },
      },
    },
  ];

  for (const targetPk of notificationTargets(message)) {
    transactItems.push({
      Put: {
        TableName: tableName,
        Item: {
          pk: targetPk,
          sk: `NOTIFICATION#${message.createdAt}#${message.eventId}`,
          entityType: 'NOTIFICATION',
          eventId: message.eventId,
          eventType: message.eventType,
          title: message.eventType.replaceAll('_', ' '),
          payload: message.payload || {},
          read: false,
          createdAt: message.createdAt,
          expiresAt: auditTtl,
        },
      },
    });
  }

  return transactItems;
}

async function processRecord(record) {
  const message = parseMessage(record);

  try {
    await documentClient.send(
      new TransactWriteCommand({
        TransactItems: buildTransaction(message),
      }),
    );
  } catch (error) {
    if (
      error?.name === 'TransactionCanceledException' ||
      error?.name === 'ConditionalCheckFailedException'
    ) {
      console.info('Background event already processed', {
        eventId: message.eventId,
        eventType: message.eventType,
      });
      return { duplicate: true, message };
    }
    throw error;
  }

  console.info('Background event processed', {
    eventId: message.eventId,
    eventType: message.eventType,
  });

  return { duplicate: false, message };
}

async function handler(event) {
  const batchItemFailures = [];

  for (const record of event.Records || []) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error('Background event failed', {
        messageId: record.messageId,
        name: error?.name,
        message: error?.message,
      });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

module.exports = {
  SUPPORTED_EVENTS,
  buildTransaction,
  handler,
  notificationTargets,
  parseMessage,
  processRecord,
};
