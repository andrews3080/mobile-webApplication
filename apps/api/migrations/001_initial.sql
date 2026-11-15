-- Asaase Ani: initial schema.
-- The database enforces the most important rules too, as a second line of defence.

CREATE TABLE reports (
  reference        text PRIMARY KEY,               -- XXXX-XXXX-XXXX, the reporter's tracking code
  idempotency_key  text NOT NULL UNIQUE,           -- makes retries safe: one key, one report
  description      text NOT NULL,
  category         text NOT NULL,
  observed_at      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL,
  area             text NOT NULL,
  area_key         text NOT NULL,                  -- lower-case, tidy spacing, used for matching
  latitude         double precision,
  longitude        double precision,
  photo_keys       text[] NOT NULL DEFAULT '{}',
  contact          jsonb,                          -- optional reporter contact details
  status           text NOT NULL CHECK (status IN (
    'received', 'under_review', 'more_information_requested',
    'verified', 'rejected', 'referred_for_action', 'closed'
  )),
  CHECK ((latitude IS NULL) = (longitude IS NULL)) -- both coordinates or neither
);

CREATE INDEX reports_area_idx ON reports (area_key, created_at DESC);

-- One row per status change: who, when, why
CREATE TABLE status_events (
  reference    text NOT NULL REFERENCES reports (reference),
  seq          integer NOT NULL,
  from_status  text NOT NULL,
  to_status    text NOT NULL,
  officer_id   text NOT NULL,
  reason       text,
  at           timestamptz NOT NULL,
  PRIMARY KEY (reference, seq)
);

-- Officers and administrators. Reporters are anonymous, so they never appear here.
CREATE TABLE users (
  id             text PRIMARY KEY,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  role           text NOT NULL CHECK (role IN ('officer', 'admin')),
  areas          text[] NOT NULL DEFAULT '{}',
  active         boolean NOT NULL DEFAULT true
);

CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- Append-only record of who did what, including refusals
CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  actor_id  text NOT NULL,
  action    text NOT NULL,
  target    text,
  outcome   text NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  detail    text,
  at        timestamptz NOT NULL
);

CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, at);

CREATE FUNCTION audit_log_refuse_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_refuse_changes();
