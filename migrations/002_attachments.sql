CREATE TABLE job_attachments (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES accounts(id),
  book text NOT NULL CHECK(book IN ('SIMULATION','TESTNET')),
  job_id uuid REFERENCES jobs(id),
  name text NOT NULL,
  media_type text NOT NULL,
  bytes integer NOT NULL CHECK(bytes > 0 AND bytes <= 2097152),
  sha256 text NOT NULL,
  ipfs_cid text,
  content_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_job ON job_attachments(job_id);
