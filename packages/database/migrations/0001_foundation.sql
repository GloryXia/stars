-- Procedural star catalogs are intentionally absent: persist sparse deltas only.
CREATE TABLE accounts (
  account_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oidc_identities (
  provider text NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_subject text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(account_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject)
);
CREATE INDEX oidc_identities_account_idx ON oidc_identities(account_id);

CREATE TABLE epochs (
  epoch_id uuid PRIMARY KEY,
  galaxy_seed text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  kappa_t integer NOT NULL DEFAULT 525960 CHECK (kappa_t = 525960),
  started_at timestamptz NOT NULL DEFAULT now(),
  committed_sim_ms bigint NOT NULL DEFAULT 0 CHECK (committed_sim_ms >= 0)
);

CREATE TABLE sectors (
  epoch_id uuid NOT NULL REFERENCES epochs(epoch_id),
  sector_id text NOT NULL,
  lease_owner text,
  lease_until timestamptz,
  fencing_token bigint NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  committed_sim_ms bigint NOT NULL DEFAULT 0 CHECK (committed_sim_ms >= 0),
  PRIMARY KEY (epoch_id, sector_id),
  CHECK ((lease_owner IS NULL) = (lease_until IS NULL))
);

CREATE TABLE seats (
  epoch_id uuid NOT NULL REFERENCES epochs(epoch_id),
  seat_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(account_id),
  current_civ_gen integer NOT NULL DEFAULT 1 CHECK (current_civ_gen > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, seat_id)
);
CREATE INDEX seats_account_idx ON seats(account_id);

CREATE TABLE civilization_generations (
  epoch_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  civ_gen integer NOT NULL CHECK (civ_gen > 0),
  sector_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'extinct')),
  view_version bigint NOT NULL DEFAULT 0 CHECK (view_version >= 0),
  state_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(state_snapshot) = 'object'),
  origin_ly double precision[] NOT NULL DEFAULT ARRAY[0,0,0]::double precision[] CHECK (array_length(origin_ly, 1) = 3),
  local_rotation double precision[] NOT NULL DEFAULT ARRAY[1,0,0,0,1,0,0,0,1]::double precision[] CHECK (array_length(local_rotation, 1) = 9),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, seat_id, civ_gen),
  FOREIGN KEY (epoch_id, seat_id) REFERENCES seats(epoch_id, seat_id),
  FOREIGN KEY (epoch_id, sector_id) REFERENCES sectors(epoch_id, sector_id)
);
ALTER TABLE seats ADD CONSTRAINT seats_current_generation_fk
  FOREIGN KEY (epoch_id, seat_id, current_civ_gen)
  REFERENCES civilization_generations(epoch_id, seat_id, civ_gen)
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX generations_sector_idx ON civilization_generations(epoch_id, sector_id, status);

-- This contains command-core knowledge only; world truth is never served directly.
CREATE TABLE seat_knowledge_snapshots (
  epoch_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  civ_gen integer NOT NULL,
  view_version bigint NOT NULL CHECK (view_version >= 0),
  observed_sim_ms bigint NOT NULL CHECK (observed_sim_ms >= 0),
  projection jsonb NOT NULL CHECK (jsonb_typeof(projection) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, seat_id, civ_gen),
  FOREIGN KEY (epoch_id, seat_id, civ_gen) REFERENCES civilization_generations(epoch_id, seat_id, civ_gen)
);

CREATE TABLE sparse_nodes (
  epoch_id uuid NOT NULL,
  catalog_node_id text NOT NULL,
  sector_id text NOT NULL,
  owner_seat_id uuid,
  owner_civ_gen integer,
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  sampled_sim_ms bigint NOT NULL CHECK (sampled_sim_ms >= 0),
  PRIMARY KEY (epoch_id, catalog_node_id),
  FOREIGN KEY (epoch_id, sector_id) REFERENCES sectors(epoch_id, sector_id),
  FOREIGN KEY (epoch_id, owner_seat_id, owner_civ_gen) REFERENCES civilization_generations(epoch_id, seat_id, civ_gen),
  CHECK ((owner_seat_id IS NULL) = (owner_civ_gen IS NULL))
);

CREATE TABLE command_receipts (
  epoch_id uuid NOT NULL,
  seat_id uuid NOT NULL,
  civ_gen integer NOT NULL,
  principal_kind text NOT NULL CHECK (principal_kind IN ('human', 'l1_reflex', 'internal_ai', 'external_agent')),
  command_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  http_status integer NOT NULL CHECK (http_status BETWEEN 100 AND 599),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, seat_id, civ_gen, principal_kind, command_id),
  FOREIGN KEY (epoch_id, seat_id, civ_gen) REFERENCES civilization_generations(epoch_id, seat_id, civ_gen)
);

CREATE TABLE pending_events (
  epoch_id uuid NOT NULL,
  event_id uuid NOT NULL,
  sector_id text NOT NULL,
  due_sim_ms bigint NOT NULL CHECK (due_sim_ms >= 0),
  phase_rank smallint NOT NULL CHECK (phase_rank >= 0),
  stable_seq bigint NOT NULL CHECK (stable_seq >= 0),
  emitted_sim_ms bigint NOT NULL CHECK (emitted_sim_ms >= 0 AND emitted_sim_ms <= due_sim_ms),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  processed_at timestamptz,
  PRIMARY KEY (epoch_id, event_id),
  UNIQUE (epoch_id, sector_id, stable_seq),
  FOREIGN KEY (epoch_id, sector_id) REFERENCES sectors(epoch_id, sector_id)
);
CREATE INDEX pending_events_due_idx ON pending_events(epoch_id, sector_id, due_sim_ms, phase_rank, stable_seq)
  WHERE processed_at IS NULL;

CREATE TABLE world_event_log (
  epoch_id uuid NOT NULL,
  sector_id text NOT NULL,
  stable_seq bigint NOT NULL CHECK (stable_seq >= 0),
  event_id uuid NOT NULL,
  due_sim_ms bigint NOT NULL CHECK (due_sim_ms >= 0),
  phase_rank smallint NOT NULL CHECK (phase_rank >= 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, sector_id, stable_seq),
  UNIQUE (epoch_id, event_id),
  FOREIGN KEY (epoch_id, sector_id) REFERENCES sectors(epoch_id, sector_id)
);

CREATE TABLE sector_checkpoints (
  epoch_id uuid NOT NULL,
  sector_id text NOT NULL,
  committed_sim_ms bigint NOT NULL CHECK (committed_sim_ms >= 0),
  last_stable_seq bigint NOT NULL CHECK (last_stable_seq >= 0),
  fencing_token bigint NOT NULL CHECK (fencing_token >= 0),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epoch_id, sector_id, committed_sim_ms),
  FOREIGN KEY (epoch_id, sector_id) REFERENCES sectors(epoch_id, sector_id)
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  account_id uuid NOT NULL REFERENCES accounts(account_id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
