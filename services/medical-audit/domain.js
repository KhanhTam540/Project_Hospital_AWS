'use strict';

const crypto = require('crypto');

const VOLATILE_FIELDS = new Set([
  'pk',
  'sk',
  'gsi1pk',
  'gsi1sk',
  'patientSk',
  'recordSk',
  'blockchainStatus',
  'blockchainTransactionId',
  'blockchainBlockNumber',
  'blockchainAnchoredAt',
  'auditEventId',
  'auditUpdatedAt',
]);

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .filter((key) => !VOLATILE_FIELDS.has(key))
      .sort()
      .reduce((result, key) => {
        const child = value[key];
        if (child !== undefined) {
          result[key] = sortValue(child);
        }
        return result;
      }, {});
  }

  return value;
}

function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value), 'utf8')
    .digest('hex');
}

function hashResource(item) {
  return sha256(canonicalize(item));
}

function normalizeEntityType(value) {
  return String(value || '').trim().toUpperCase();
}

const ELIGIBLE_ENTITY_TYPES = new Set([
  'MEDICAL_RECORD',
  'EXAMINATION',
  'LAB_RESULT',
  'PRESCRIPTION',
  'MEDICAL_DOCUMENT',
  'INVOICE',
  'AI_MEDICAL_SUMMARY',
]);

function isMedicalRecordEntity(item = {}) {
  const entityType = normalizeEntityType(item.entityType);
  if (!ELIGIBLE_ENTITY_TYPES.has(entityType)) return false;

  // New entities use a direct METADATA item. The existing admin medical
  // record module stores the canonical record under PATIENT#.../MEDICAL_RECORD#...
  // without a direct copy, so that single legacy shape is also eligible.
  const sk = String(item.sk || '');
  return (
    sk === 'METADATA' ||
    (entityType === 'MEDICAL_RECORD' && sk.startsWith('MEDICAL_RECORD#'))
  );
}

function getMedicalRecordId(item = {}) {
  return (
    item.medicalRecordId ||
    item.recordId ||
    item.maHSBA ||
    null
  );
}

function getResourceId(item = {}) {
  return (
    item.recordId ||
    item.examinationId ||
    item.labResultId ||
    item.prescriptionId ||
    item.documentId ||
    item.invoiceId ||
    item.summaryId ||
    String(item.pk || '').split('#').slice(1).join('#') ||
    null
  );
}

function actionForChange(eventName, item = {}) {
  const entityType = normalizeEntityType(item.entityType);
  const status = String(item.status || item.trangThai || '')
    .trim()
    .toUpperCase();

  if (eventName === 'REMOVE') return `${entityType}_DELETED`;

  if (entityType === 'LAB_RESULT' && status === 'APPROVED') {
    return 'LAB_RESULT_APPROVED';
  }

  if (entityType === 'EXAMINATION' && status === 'COMPLETED') {
    return 'EXAMINATION_COMPLETED';
  }

  if (entityType === 'PRESCRIPTION' && status === 'DISPENSED') {
    return 'PRESCRIPTION_DISPENSED';
  }

  if (
    entityType === 'INVOICE' &&
    ['PAID', 'DA_THANH_TOAN', 'SUCCESS'].includes(status)
  ) {
    return 'INVOICE_PAID';
  }

  if (
    entityType === 'MEDICAL_DOCUMENT' &&
    status === 'AVAILABLE'
  ) {
    return 'MEDICAL_DOCUMENT_UPLOADED';
  }

  if (entityType === 'AI_MEDICAL_SUMMARY') {
    return 'AI_SUMMARY_APPROVED';
  }

  return `${entityType}_${eventName === 'INSERT' ? 'CREATED' : 'UPDATED'}`;
}

function createAuditEvent({ eventName, item, oldItem, occurredAt }) {
  const source = eventName === 'REMOVE' ? oldItem : item;
  const medicalRecordId = getMedicalRecordId(source);
  const resourceId = getResourceId(source);

  if (!medicalRecordId || !resourceId) return null;

  const payloadHash = hashResource(source);
  const entityType = normalizeEntityType(source.entityType);
  const timestamp = occurredAt || new Date().toISOString();
  const eventSeed = [
    eventName,
    source.pk,
    source.sk,
    source.version || source.updatedAt || timestamp,
    payloadHash,
  ].join('|');

  return {
    eventId: `AUD-${sha256(eventSeed).slice(0, 24).toUpperCase()}`,
    medicalRecordId: String(medicalRecordId),
    resourceType: entityType,
    resourceId: String(resourceId),
    action: actionForChange(eventName, source),
    resourceVersion: Number(source.version || 1),
    payloadHash,
    sourcePk: source.pk,
    sourceSk: source.sk,
    occurredAt: timestamp,
  };
}

function auditPartitionKey(recordId) {
  return `MEDICAL_RECORD_AUDIT#${String(recordId).trim().toUpperCase()}`;
}

function encodeAnchorPayload(event) {
  return {
    eventIdHash: `0x${sha256(event.eventId)}`,
    medicalRecordIdHash: `0x${sha256(event.medicalRecordId)}`,
    resourceIdHash: `0x${sha256(event.resourceId)}`,
    payloadHash: `0x${event.payloadHash}`,
    metadataHash: `0x${sha256(
      canonicalize({
        action: event.action,
        resourceType: event.resourceType,
        resourceVersion: event.resourceVersion,
        occurredAt: event.occurredAt,
      }),
    )}`,
  };
}

module.exports = {
  ELIGIBLE_ENTITY_TYPES,
  actionForChange,
  auditPartitionKey,
  canonicalize,
  createAuditEvent,
  encodeAnchorPayload,
  getMedicalRecordId,
  getResourceId,
  hashResource,
  isMedicalRecordEntity,
  sha256,
  sortValue,
};
