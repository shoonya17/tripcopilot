CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE "TripStatus" AS ENUM ('PLANNED','ACTIVE','COMPLETED','CANCELLED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SegmentStatus" AS ENUM ('BOOKED','CONFIRMED','CHANGED','CANCELLED','COMPLETED','UNKNOWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ConflictStatus" AS ENUM ('DETECTED','REVIEWED','RESOLVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ConsentStatus" AS ENUM ('PENDING','GRANTED','WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IngestionProductState" AS ENUM ('RECEIVED','PARSING','EXTRACTED','REVIEW_REQUIRED','CONFIRMED','PARSE_FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "IngestionImplementationState" AS ENUM ('RECEIVED','AUTHORIZED','SECURITY_CHECK','PARSING','EXTRACTED','VALIDATED','COMMITTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ValidationResult" AS ENUM ('VALID','REVIEW_REQUIRED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DedupResult" AS ENUM ('NEW','DUPLICATE_ABSORBED','AMBIGUOUS_REVIEW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ActorType" AS ENUM ('USER','SYSTEM','SUPPORT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GroupRole" AS ENUM ('OWNER','PARTICIPANT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentRetentionState" AS ENUM ('ACTIVE','PENDING_DELETION','RETAINED','DELETED','QUARANTINED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ConsentType" AS ENUM ('INGESTION','SAFETY','LOCATION','BRIEFING_GROUP','CHANNEL_BINDING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Channel" AS ENUM ('EMAIL','WHATSAPP','PDF','TEXT','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS traveler (
  traveler_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  auth_subject TEXT UNIQUE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  locale TEXT,
  default_timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS traveler_tenant_idx ON traveler(tenant_id);
CREATE INDEX IF NOT EXISTS traveler_email_idx ON traveler(tenant_id,email);
CREATE INDEX IF NOT EXISTS traveler_phone_idx ON traveler(tenant_id,phone);

CREATE TABLE IF NOT EXISTS trip (
  trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  owner_traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  title TEXT,
  status "TripStatus" NOT NULL DEFAULT 'PLANNED',
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  start_timezone TEXT,
  end_timezone TEXT,
  last_briefing_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (start_at IS NULL OR end_at IS NULL OR start_at <= end_at)
);
CREATE INDEX IF NOT EXISTS trip_owner_idx ON trip(tenant_id,owner_traveler_id,status);
CREATE INDEX IF NOT EXISTS trip_time_idx ON trip(tenant_id,start_at,end_at);

CREATE TABLE IF NOT EXISTS group_trip (
  group_trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL UNIQUE REFERENCES trip(trip_id) ON DELETE CASCADE,
  owner_traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  name TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS group_trip_tenant_idx ON group_trip(tenant_id,trip_id);

CREATE TABLE IF NOT EXISTS group_trip_participant (
  group_trip_id UUID NOT NULL REFERENCES group_trip(group_trip_id) ON DELETE CASCADE,
  traveler_id UUID NOT NULL REFERENCES traveler(traveler_id) ON DELETE CASCADE,
  role "GroupRole" NOT NULL DEFAULT 'PARTICIPANT',
  status TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY(group_trip_id,traveler_id)
);

CREATE TABLE IF NOT EXISTS trusted_contact (
  trusted_contact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  name TEXT NOT NULL,
  contact_value TEXT NOT NULL,
  contact_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS trusted_contact_idx ON trusted_contact(tenant_id,traveler_id);

CREATE TABLE IF NOT EXISTS safety_checkin (
  safety_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  shared_at TIMESTAMPTZ NOT NULL,
  location_lat NUMERIC(9,6),
  location_long NUMERIC(9,6),
  location_accuracy_m NUMERIC(10,2),
  consent_reference UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS safety_checkin_idx ON safety_checkin(tenant_id,trip_id,shared_at);

CREATE TABLE IF NOT EXISTS segment (
  segment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL,
  supplier_name TEXT,
  booking_reference TEXT,
  departure_local TIMESTAMP,
  departure_timezone TEXT,
  departure_utc TIMESTAMPTZ,
  arrival_local TIMESTAMP,
  arrival_timezone TEXT,
  arrival_utc TIMESTAMPTZ,
  departure_location TEXT,
  arrival_location TEXT,
  status "SegmentStatus" NOT NULL DEFAULT 'UNKNOWN',
  traveler_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (departure_utc IS NULL OR arrival_utc IS NULL OR departure_utc <= arrival_utc)
);
CREATE INDEX IF NOT EXISTS segment_trip_departure_idx ON segment(tenant_id,trip_id,departure_utc);
CREATE INDEX IF NOT EXISTS segment_trip_status_idx ON segment(tenant_id,trip_id,status);
CREATE INDEX IF NOT EXISTS segment_booking_idx ON segment(tenant_id,supplier_name,booking_reference);

CREATE TABLE IF NOT EXISTS connection (
  connection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  from_segment_id UUID NOT NULL REFERENCES segment(segment_id),
  to_segment_id UUID NOT NULL REFERENCES segment(segment_id),
  connection_type TEXT,
  is_inferred BOOLEAN NOT NULL,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK (from_segment_id <> to_segment_id)
);
CREATE INDEX IF NOT EXISTS connection_trip_idx ON connection(tenant_id,trip_id);

CREATE TABLE IF NOT EXISTS document (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID REFERENCES trip(trip_id),
  segment_id UUID REFERENCES segment(segment_id),
  source_type TEXT NOT NULL,
  source_reference TEXT,
  storage_object_key TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL,
  retention_state "DocumentRetentionState" NOT NULL,
  security_state TEXT NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT false,
  legal_hold_reason TEXT,
  legal_hold_at TIMESTAMPTZ,
  supplier_name TEXT,
  booking_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  UNIQUE(tenant_id,content_hash,version)
);
CREATE INDEX IF NOT EXISTS document_trip_retention_idx ON document(tenant_id,trip_id,retention_state);

CREATE TABLE IF NOT EXISTS budget (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  currency CHAR(3) NOT NULL,
  planned_amount NUMERIC(19,4) NOT NULL CHECK (planned_amount >= 0),
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS budget_trip_idx ON budget(tenant_id,trip_id);

CREATE TABLE IF NOT EXISTS expense (
  expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  traveler_id UUID REFERENCES traveler(traveler_id),
  group_trip_id UUID REFERENCES group_trip(group_trip_id),
  amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  category TEXT,
  merchant_or_description TEXT NOT NULL,
  incurred_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  source TEXT NOT NULL,
  source_type TEXT NOT NULL,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  user_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS expense_trip_time_idx ON expense(tenant_id,trip_id,incurred_at);
CREATE INDEX IF NOT EXISTS expense_trip_category_idx ON expense(tenant_id,trip_id,category);

CREATE TABLE IF NOT EXISTS preference_set (
  preference_set_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('TRAVELER','TRIP')),
  traveler_id UUID REFERENCES traveler(traveler_id),
  trip_id UUID REFERENCES trip(trip_id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0),
  CHECK ((scope='TRAVELER' AND traveler_id IS NOT NULL AND trip_id IS NULL) OR (scope='TRIP' AND traveler_id IS NULL AND trip_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS preference_traveler_unique ON preference_set(tenant_id,traveler_id,preference_key) WHERE scope='TRAVELER';
CREATE UNIQUE INDEX IF NOT EXISTS preference_trip_unique ON preference_set(tenant_id,trip_id,preference_key) WHERE scope='TRIP';
CREATE INDEX IF NOT EXISTS preference_traveler_idx ON preference_set(tenant_id,traveler_id,scope);
CREATE INDEX IF NOT EXISTS preference_trip_idx ON preference_set(tenant_id,trip_id,scope);

CREATE TABLE IF NOT EXISTS conflict (
  conflict_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  status "ConflictStatus" NOT NULL DEFAULT 'DETECTED',
  description TEXT NOT NULL,
  evidence JSONB NOT NULL,
  suppression_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version > 0)
);
CREATE INDEX IF NOT EXISTS conflict_trip_status_idx ON conflict(tenant_id,trip_id,status);
CREATE UNIQUE INDEX IF NOT EXISTS conflict_suppression_unique ON conflict(tenant_id,trip_id,suppression_key) WHERE suppression_key IS NOT NULL;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE conflict ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
UPDATE conflict SET summary = COALESCE(summary, description) WHERE summary IS NULL;
ALTER TABLE conflict ALTER COLUMN summary SET NOT NULL;

CREATE TABLE IF NOT EXISTS consent (
  consent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  trip_id UUID REFERENCES trip(trip_id) ON DELETE CASCADE,
  consent_type "ConsentType" NOT NULL,
  status "ConsentStatus" NOT NULL DEFAULT 'PENDING',
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_idx ON consent(tenant_id,traveler_id,consent_type,status);

CREATE TABLE IF NOT EXISTS field_provenance (
  provenance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT,
  source_version INTEGER,
  source_excerpt TEXT,
  extracted_by TEXT,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  is_user_originated BOOLEAN NOT NULL DEFAULT false,
  user_actor_id UUID,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provenance_entity_idx ON field_provenance(tenant_id,entity_type,entity_id,field_name);

CREATE TABLE IF NOT EXISTS ingestion_record (
  ingestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  traveler_id UUID REFERENCES traveler(traveler_id),
  channel "Channel" NOT NULL,
  source_reference TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  product_state "IngestionProductState" NOT NULL,
  security_state TEXT NOT NULL,
  implementation_state "IngestionImplementationState" NOT NULL,
  content_hash TEXT,
  document_id UUID REFERENCES document(document_id),
  trip_id UUID REFERENCES trip(trip_id),
  parse_attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL,
  raw_text TEXT,
  UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS ingestion_received_idx ON ingestion_record(tenant_id,received_at);
CREATE INDEX IF NOT EXISTS ingestion_state_idx ON ingestion_record(tenant_id,product_state);

CREATE TABLE IF NOT EXISTS source_candidate (
  candidate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ingestion_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  candidate_value JSONB NOT NULL,
  normalized_value JSONB,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_location JSONB,
  source_excerpt TEXT,
  extraction_method TEXT NOT NULL,
  extracted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidate_ingestion_idx ON source_candidate(tenant_id,ingestion_id);

CREATE TABLE IF NOT EXISTS validation_result (
  validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ingestion_id UUID NOT NULL,
  result "ValidationResult" NOT NULL,
  issues JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS validation_ingestion_idx ON validation_result(tenant_id,ingestion_id);

CREATE TABLE IF NOT EXISTS dedup_decision (
  dedup_decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  ingestion_id UUID NOT NULL,
  result "DedupResult" NOT NULL,
  matched_entity_type TEXT,
  matched_entity_id UUID,
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dedup_ingestion_idx ON dedup_decision(tenant_id,ingestion_id);

CREATE TABLE IF NOT EXISTS event_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID REFERENCES trip(trip_id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  behavioral_class TEXT,
  actor_type "ActorType" NOT NULL,
  actor_id UUID,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_trip_time_idx ON event_log(tenant_id,trip_id,occurred_at);
CREATE INDEX IF NOT EXISTS event_name_time_idx ON event_log(tenant_id,event_name,occurred_at);

CREATE TABLE IF NOT EXISTS outbox_event (
  outbox_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_publish_idx ON outbox_event(published_at,available_at,created_at);

CREATE TABLE IF NOT EXISTS idempotency_record (
  idempotency_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,key)
);
CREATE INDEX IF NOT EXISTS idempotency_tenant_idx ON idempotency_record(tenant_id,created_at);

CREATE TABLE IF NOT EXISTS briefing_generation (
  briefing_generation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  travel_date TIMESTAMPTZ NOT NULL,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  generation_key TEXT NOT NULL UNIQUE,
  model TEXT,
  policy_version TEXT
);
CREATE INDEX IF NOT EXISTS briefing_trip_date_idx ON briefing_generation(tenant_id,trip_id,travel_date);

CREATE TABLE IF NOT EXISTS notification_delivery (
  notification_delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  briefing_generation_id UUID REFERENCES briefing_generation(briefing_generation_id),
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivery_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  attempted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS notification_trip_idx ON notification_delivery(tenant_id,trip_id,attempted_at);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID REFERENCES trip(trip_id) ON DELETE CASCADE,
  actor_type "ActorType" NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_tenant_idx ON audit_log(tenant_id,created_at);

CREATE TABLE IF NOT EXISTS referral_click (
  referral_click_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES trip(trip_id) ON DELETE CASCADE,
  referral_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  destination TEXT NOT NULL,
  disclosed BOOLEAN NOT NULL DEFAULT true,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_trip_idx ON referral_click(tenant_id,trip_id,clicked_at);

CREATE TABLE IF NOT EXISTS channel_binding (
  channel_binding_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  traveler_id UUID NOT NULL REFERENCES traveler(traveler_id),
  channel "Channel" NOT NULL,
  external_address TEXT NOT NULL,
  verification_state TEXT NOT NULL,
  verification_code TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,channel,external_address)
);
