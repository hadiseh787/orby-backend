CREATE TABLE knowledge_collections (
 id uuid PRIMARY KEY,owner_id text NOT NULL REFERENCES accounts(id),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),
 name text NOT NULL,content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX knowledge_owner ON knowledge_collections(owner_id,book);
CREATE TABLE workspace_programs (
 id uuid PRIMARY KEY,owner_id text NOT NULL REFERENCES accounts(id),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),
 kind text NOT NULL CHECK(kind IN ('RECURRING','MILESTONES','TRIALS')),state text NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','PAUSED','COMPLETED')),
 name text NOT NULL,data jsonb NOT NULL,next_run_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE program_runs (
 id uuid PRIMARY KEY,program_id uuid NOT NULL REFERENCES workspace_programs(id),job_id uuid NOT NULL REFERENCES jobs(id),
 slot text NOT NULL,reserved_yocto numeric(78,0) NOT NULL CHECK(reserved_yocto>0),period text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(program_id,slot)
);
CREATE INDEX program_runs_program ON program_runs(program_id,created_at);
CREATE TABLE google_connections (
 owner_id text NOT NULL REFERENCES accounts(id),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),encrypted_tokens text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,book)
);
CREATE TABLE google_oauth_states (
 id_hash text PRIMARY KEY,owner_id text NOT NULL REFERENCES accounts(id),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),verifier text NOT NULL,expires_at timestamptz NOT NULL
);
CREATE TABLE sheet_exports (
 id uuid PRIMARY KEY,owner_id text NOT NULL REFERENCES accounts(id),book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),job_id uuid NOT NULL REFERENCES jobs(id),
 state text NOT NULL DEFAULT 'PREVIEW',data jsonb NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
