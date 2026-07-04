# Hospital_P2TB DynamoDB Single-Table Design

## Table keys

- Partition key: `pk`
- Sort key: `sk`
- GSI1 partition key: `gsi1pk`
- GSI1 sort key: `gsi1sk`
- TTL attribute: `expiresAt`

## Entity types

`USER`, `DEPARTMENT`, `ROOM`, `STAFF`, `DOCTOR`, `PATIENT`, `WORK_SCHEDULE`, `APPOINTMENT`, `MEDICAL_RECORD`, `MEDICINE`, `PRESCRIPTION`, `PRESCRIPTION_ITEM`.

## Access patterns

| Query | Key expression |
|---|---|
| User by ID | `pk=USER#id`, `sk=PROFILE` |
| Department by ID | `pk=DEPARTMENT#id`, `sk=META` |
| Rooms in department | `pk=DEPARTMENT#id`, `begins_with(sk, ROOM#)` |
| Staff or doctor by ID | `pk=STAFF#id`, `sk=PROFILE` |
| Work schedules by staff | `pk=STAFF#id`, `begins_with(sk, SCHEDULE#)` |
| Patient by ID | `pk=PATIENT#id`, `sk=PROFILE` |
| Appointments by patient | `pk=PATIENT#id`, `begins_with(sk, APPOINTMENT#)` |
| Appointments by doctor | GSI1 `gsi1pk=DOCTOR#id` |
| Medical records by patient | `pk=PATIENT#id`, `begins_with(sk, MEDICAL_RECORD#)` |
| Prescription by record | `pk=MEDICAL_RECORD#id`, `begins_with(sk, PRESCRIPTION#)` |

DynamoDB has no foreign key. Lambda must validate referenced entities before writes and use conditional writes or transactions where consistency is required.
