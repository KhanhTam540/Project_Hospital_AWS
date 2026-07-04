'use strict';

const { randomUUID } = require('node:crypto');
const {
  SendMessageCommand,
  SQSClient,
} = require('@aws-sdk/client-sqs');

let sqsClient;

function getClient() {
  if (!sqsClient) sqsClient = new SQSClient({});
  return sqsClient;
}

function getQueueUrl() {
  return (
    process.env.BACKGROUND_QUEUE_URL ||
    process.env.CORE_TASK_QUEUE_URL ||
    ''
  ).trim();
}

function buildEvent(eventType, payload, actor = {}) {
  return {
    eventId: randomUUID(),
    eventType,
    createdAt: new Date().toISOString(),
    actor: {
      sub: actor.sub || null,
      username: actor.username || null,
      groups: Array.isArray(actor.groups) ? actor.groups : [],
    },
    payload,
  };
}

async function publishEvent(eventType, payload, actor = {}) {
  const queueUrl = getQueueUrl();
  if (!queueUrl) {
    console.warn('BACKGROUND_QUEUE_URL is not configured; event skipped', {
      eventType,
    });
    return null;
  }

  const event = buildEvent(eventType, payload, actor);

  await getClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: {
        eventType: {
          DataType: 'String',
          StringValue: eventType,
        },
      },
    }),
  );

  return event;
}

module.exports = {
  buildEvent,
  getQueueUrl,
  publishEvent,
};
